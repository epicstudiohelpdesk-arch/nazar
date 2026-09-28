import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import {
  ErrorCode,
  type DiscoveryItemDto,
  type DiscoveryResponseDto,
  getDistanceBucket,
  type PublicProfileResponse,
  type Gender,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import {
  PREFERENCES_REPOSITORY_TOKEN,
  type IPreferencesRepository,
} from '../../profiles/repositories/preferences.repository.js';
import {
  CANDIDATE_REPOSITORY_TOKEN,
  type ICandidateRepository,
} from '../repositories/candidate.repository.interface.js';
import {
  CANDIDATE_RANKER_TOKEN,
  type ICandidateRanker,
} from '../ranker/candidate-ranker.interface.js';
import {
  DISCOVERY_CURSOR_SERVICE_TOKEN,
  type IDiscoveryCursorService,
} from '../cursor/discovery-cursor.interface.js';
import {
  CANDIDATE_EXCLUSION_PROVIDER_TOKEN,
  type ICandidateExclusionProvider,
} from '../exclusions/candidate-exclusion.interface.js';
import type { DiscoveryViewerContext, DiscoveryCursorPayload } from '../domain/discovery.types.js';

export interface GetDiscoveryOptions {
  readonly limit?: number;
  readonly cursor?: string;
  readonly ipAddress?: string;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(PREFERENCES_REPOSITORY_TOKEN)
    private readonly preferencesRepo: IPreferencesRepository,
    @Inject(CANDIDATE_REPOSITORY_TOKEN)
    private readonly candidateRepo: ICandidateRepository,
    @Inject(CANDIDATE_RANKER_TOKEN)
    private readonly candidateRanker: ICandidateRanker,
    @Inject(DISCOVERY_CURSOR_SERVICE_TOKEN)
    private readonly cursorService: IDiscoveryCursorService,
    @Inject(CANDIDATE_EXCLUSION_PROVIDER_TOKEN)
    private readonly exclusionProvider: ICandidateExclusionProvider
  ) {}

  async getDiscoveryFeed(
    viewerUserId: string,
    options: GetDiscoveryOptions = {}
  ): Promise<DiscoveryResponseDto> {
    const startTime = Date.now();

    // 1. Resolve and validate viewer's discovery context
    const context = await this.buildViewerContext(viewerUserId);

    // 2. Validate limit (default: 20, max: 50, min: 1)
    const limit = this.validateLimit(options.limit);

    // 3. Decode & validate cursor if provided
    let cursorPayload: DiscoveryCursorPayload | null = null;
    if (options.cursor) {
      cursorPayload = this.cursorService.decode(options.cursor);
    }

    // 4. Retrieve exclusions (future Gate 07 likes/passes, Gate 09 blocks)
    const excludedUserIds = await this.exclusionProvider.getExcludedUserIds(viewerUserId);

    // 5. Query candidate universe from PostgreSQL/PostGIS
    const dbStartTime = Date.now();
    const candidatePool = await this.candidateRepo.findEligibleCandidates(
      context,
      excludedUserIds,
      250 // Safe bounded candidate retrieval pool
    );
    const dbDuration = Date.now() - dbStartTime;

    // 6. Deterministic Candidate Ranking
    const rankStartTime = Date.now();
    const rankedCandidates = this.candidateRanker.rank(candidatePool, context);
    const rankDuration = Date.now() - rankStartTime;

    // 7. Apply cursor filtering for stable pagination
    let paginatedRanked = rankedCandidates;
    if (cursorPayload) {
      const { score: cursorScore, id: cursorId } = cursorPayload;
      paginatedRanked = rankedCandidates.filter((r) => {
        if (r.score < cursorScore) {
          return true;
        }
        if (r.score === cursorScore && r.tieBreaker > cursorId) {
          return true;
        }
        return false;
      });
    }

    // 8. Slice requested page
    const hasMore = paginatedRanked.length > limit;
    const pageCandidates = paginatedRanked.slice(0, limit);

    // 9. Compute next cursor
    let nextCursor: string | null = null;
    if (hasMore && pageCandidates.length > 0) {
      const last = pageCandidates[pageCandidates.length - 1]!;
      nextCursor = this.cursorService.encode(last.score, last.tieBreaker);
    }

    // 10. Batched hydration of public profile components (interests, prompts, READY media)
    const profileIds = pageCandidates.map((c) => c.candidate.profileId);
    const hydratedComponents = await this.candidateRepo.batchHydrateComponents(profileIds);

    // 11. Assemble public discovery items (privacy-preserving)
    const items: DiscoveryItemDto[] = pageCandidates.map((c) => {
      const candidate = c.candidate;
      const components = hydratedComponents.get(candidate.profileId) || {
        interests: [],
        prompts: [],
        media: [],
      };

      const publicProfile: PublicProfileResponse = {
        id: candidate.profileId,
        userId: candidate.userId,
        displayName: candidate.displayName,
        age: candidate.age,
        gender: candidate.gender,
        bio: candidate.bio,
        occupation: candidate.occupation,
        education: candidate.education,
        city: candidate.city,
        countryCode: candidate.countryCode,
        interests: components.interests,
        prompts: components.prompts,
        media: components.media,
      };

      const distanceBucket = getDistanceBucket(candidate.distanceMeters);

      return {
        profile: publicProfile,
        distanceBucket,
      };
    });

    const totalDuration = Date.now() - startTime;
    this.logger.debug(
      `[discovery] viewer=${viewerUserId} pool=${candidatePool.length} returned=${items.length} dbMs=${dbDuration} rankMs=${rankDuration} totalMs=${totalDuration}`
    );

    return {
      items,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  private async buildViewerContext(viewerUserId: string): Promise<DiscoveryViewerContext> {
    const profile = await this.profileRepo.findByUserId(viewerUserId);
    if (!profile) {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_NOT_READY,
        message: 'Profile not found. You must create and activate a profile to discover matches.',
      });
    }

    if (profile.visibility !== 'ACTIVE') {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_NOT_READY,
        message: `Profile is in ${profile.visibility} state. Your profile must be ACTIVE to discover matches.`,
      });
    }

    const preferences = await this.preferencesRepo.findByUserId(viewerUserId);
    const age = calculateAge(profile.dateOfBirth);

    const location =
      profile.latitude !== null &&
      profile.latitude !== undefined &&
      profile.longitude !== null &&
      profile.longitude !== undefined
        ? { latitude: profile.latitude, longitude: profile.longitude }
        : null;

    return {
      userId: viewerUserId,
      profileId: profile.id,
      age,
      gender: profile.gender as Gender,
      location,
      minAge: preferences?.minAge ?? 18,
      maxAge: preferences?.maxAge ?? 99,
      genderPreferences: preferences?.genderPreferences ?? ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER'],
      maxDistanceKm: preferences?.maxDistanceKm ?? 50,
      relationshipIntent: preferences?.relationshipIntent ?? 'LONG_TERM',
    };
  }

  private validateLimit(limit?: number): number {
    if (limit === undefined || limit === null) {
      return 20;
    }

    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new BadRequestException({
        code: ErrorCode.DISCOVERY_INVALID_LIMIT,
        message: 'Limit must be an integer between 1 and 50',
      });
    }

    return parsed;
  }
}
