import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import {
  ErrorCode,
  type MatchListResponseDto,
  type MatchDetailDto,
  type UnmatchResponseDto,
  type MatchItemDto,
  type MatchStatus,
  type PublicMediaItem,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  profiles,
  profileMedia,
  outboxEvents,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import {
  MATCHES_REPOSITORY_TOKEN,
  type IMatchesRepository,
} from '../repositories/matches.repository.interface.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import {
  MEDIA_REPOSITORY_TOKEN,
  type IMediaRepository,
} from '../../profiles/repositories/media.repository.js';
import {
  INTEREST_REPOSITORY_TOKEN,
  type IInterestRepository,
} from '../../profiles/repositories/interest.repository.js';
import {
  PROMPT_REPOSITORY_TOKEN,
  type IPromptRepository,
} from '../../profiles/repositories/prompt.repository.js';

export interface GetMatchesOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

interface MatchCursorPayload {
  readonly matchedAt: string;
  readonly id: string;
}

@Injectable()
export class MatchesService {
  constructor(
    @Inject(MATCHES_REPOSITORY_TOKEN)
    private readonly matchesRepo: IMatchesRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(MEDIA_REPOSITORY_TOKEN)
    private readonly mediaRepo: IMediaRepository,
    @Inject(INTEREST_REPOSITORY_TOKEN)
    private readonly interestRepo: IInterestRepository,
    @Inject(PROMPT_REPOSITORY_TOKEN)
    private readonly promptRepo: IPromptRepository,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getMatches(
    userId: string,
    options: GetMatchesOptions = {}
  ): Promise<MatchListResponseDto> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);

    // Decode cursor
    let parsedCursor: { matchedAt: Date; id: string } | undefined;
    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64url').toString('utf8');
        const payload = JSON.parse(decoded) as MatchCursorPayload;
        if (payload.matchedAt && payload.id) {
          parsedCursor = {
            matchedAt: new Date(payload.matchedAt),
            id: payload.id,
          };
        }
      } catch {
        throw new HttpException(
          { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid match cursor provided' },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Query limit + 1 to detect hasMore
    const rows = await this.matchesRepo.findActiveMatchesForUser(userId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const matchRows = hasMore ? rows.slice(0, limit) : rows;

    if (matchRows.length === 0) {
      return {
        items: [],
        pagination: {
          nextCursor: null,
          hasMore: false,
          limit,
        },
      };
    }

    // Collect other user IDs
    const otherUserIds = matchRows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));

    // Batch query profiles
    const client = this.databaseService.client;
    const otherProfiles = await client
      .select()
      .from(profiles)
      .where(inArray(profiles.userId, otherUserIds));

    const profileByUserId = new Map(otherProfiles.map((p) => [p.userId, p]));

    // Batch query primary media for other users
    const otherProfileIds = otherProfiles.map((p) => p.id);
    const primaryMediaRows =
      otherProfileIds.length > 0
        ? await client
            .select()
            .from(profileMedia)
            .where(
              inArray(profileMedia.profileId, otherProfileIds)
            )
        : [];

    const primaryPhotoByProfileId = new Map<string, string>();
    for (const m of primaryMediaRows) {
      if (m.status === 'READY' && m.isPrimary) {
        primaryPhotoByProfileId.set(m.profileId, this.storageService.getPublicUrl(m.objectKey));
      }
    }

    // Construct response items
    const items: MatchItemDto[] = matchRows.map((row) => {
      const otherId = row.userAId === userId ? row.userBId : row.userAId;
      const prof = profileByUserId.get(otherId);

      const displayName = prof?.displayName || 'Unknown';
      const age = prof ? calculateAge(prof.dateOfBirth) : 18;
      const city = prof?.city || null;
      const countryCode = prof?.countryCode || null;
      const profileId = prof?.id || otherId;
      const primaryPhotoUrl = prof ? primaryPhotoByProfileId.get(prof.id) || null : null;

      return {
        id: row.id,
        matchedAt: row.matchedAt.toISOString(),
        status: row.status as MatchStatus,
        otherUser: {
          userId: otherId,
          profileId,
          displayName,
          age,
          city,
          countryCode,
          primaryPhotoUrl,
        },
      };
    });

    // Build next cursor
    let nextCursor: string | null = null;
    if (hasMore && matchRows.length > 0) {
      const lastItem = matchRows[matchRows.length - 1];
      if (lastItem) {
        const payload: MatchCursorPayload = {
          matchedAt: lastItem.matchedAt.toISOString(),
          id: lastItem.id,
        };
        nextCursor = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
      }
    }

    return {
      items,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getMatchDetail(userId: string, matchId: string): Promise<MatchDetailDto> {
    const match = await this.matchesRepo.findMatchById(matchId);
    if (!match) {
      throw new HttpException(
        { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found' },
        HttpStatus.NOT_FOUND
      );
    }

    // Verify membership
    if (match.userAId !== userId && match.userBId !== userId) {
      throw new HttpException(
        { code: ErrorCode.MATCH_ACCESS_DENIED, message: 'You are not a member of this match' },
        HttpStatus.FORBIDDEN
      );
    }

    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const profile = await this.profileRepo.findByUserId(otherUserId);
    if (!profile) {
      throw new HttpException(
        { code: ErrorCode.PROFILE_NOT_FOUND, message: 'Matched profile not found' },
        HttpStatus.NOT_FOUND
      );
    }

    // Hydrate public components
    const media = await this.mediaRepo.findByUserId(otherUserId);
    const readyMedia: PublicMediaItem[] = media
      .filter((m) => m.status === 'READY')
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        url: this.storageService.getPublicUrl(m.objectKey),
        mediaType: m.mediaType,
        position: m.position,
        isPrimary: m.isPrimary,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
      }));

    const interests = await this.interestRepo.findByProfileId(profile.id);
    const prompts = await this.promptRepo.findByProfileId(profile.id);

    return {
      id: match.id,
      matchedAt: match.matchedAt.toISOString(),
      status: match.status as MatchStatus,
      otherUser: {
        userId: otherUserId,
        profileId: profile.id,
        displayName: profile.displayName,
        age: calculateAge(profile.dateOfBirth),
        bio: profile.bio || null,
        occupation: profile.occupation || null,
        education: profile.education || null,
        city: profile.city || null,
        countryCode: profile.countryCode || null,
        media: readyMedia,
        interests,
        prompts,
      },
    };
  }

  async unmatch(
    userId: string,
    matchId: string,
    reason?: string
  ): Promise<UnmatchResponseDto> {
    const match = await this.matchesRepo.findMatchById(matchId);
    if (!match) {
      throw new HttpException(
        { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found' },
        HttpStatus.NOT_FOUND
      );
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      throw new HttpException(
        { code: ErrorCode.MATCH_ACCESS_DENIED, message: 'You are not a member of this match' },
        HttpStatus.FORBIDDEN
      );
    }

    if (match.status === 'UNMATCHED') {
      return {
        success: true,
        matchId,
        status: 'UNMATCHED',
      };
    }

    return this.databaseService.withTransaction(async (tx) => {
      const updated = await this.matchesRepo.unmatch(matchId, userId, reason, tx);

      const otherUserId = match.userAId === userId ? match.userBId : match.userAId;

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'match.unmatched',
        aggregateType: 'MATCH',
        aggregateId: matchId,
        payload: {
          matchId,
          unmatchedByUserId: userId,
          otherUserId,
          reason: reason || 'USER_INITIATED',
          unmatchedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });

      return {
        success: true,
        matchId,
        status: (updated?.status || 'UNMATCHED') as MatchStatus,
      };
    });
  }
}
