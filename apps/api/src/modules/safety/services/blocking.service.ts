import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type BlockUserResponseDto,
  type UnblockUserResponseDto,
  type BlockedUserListResponseDto,
  type BlockedUserItemDto,
  type BlockContactsResponseDto,
  type BlockedContactsListResponseDto,
} from '@platform/api-contracts';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import { matches } from '../../../infrastructure/database/drizzle/schema/matches.js';
import { conversations } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../repositories/user-blocks.repository.interface.js';
import {
  BLOCKED_CONTACTS_REPOSITORY_TOKEN,
  type IBlockedContactsRepository,
} from '../repositories/blocked-contacts.repository.interface.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import type { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { generateUuidV7 } from '@platform/domain';
import { eq, and, or } from 'drizzle-orm';
import type { GetBlockedUsersQueryInput } from '@platform/validation';

export interface BlockCursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

function encodeBlockCursor(payload: BlockCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeBlockCursor(cursor: string): BlockCursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw) as BlockCursorPayload;
  } catch {
    return null;
  }
}

function calculateAge(dateOfBirth: string | Date | null): number {
  if (!dateOfBirth) return 25;
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

@Injectable()
export class BlockingService {
  constructor(
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(BLOCKED_CONTACTS_REPOSITORY_TOKEN)
    private readonly blockedContactsRepo: IBlockedContactsRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async blockUser(
    blockerUserId: string,
    targetUserId: string,
    reason?: string
  ): Promise<BlockUserResponseDto> {
    if (blockerUserId === targetUserId) {
      throw new HttpException(
        {
          code: ErrorCode.BLOCK_SELF,
          message: 'A user cannot block themselves',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Verify target exists
    const targetProfile = await this.profileRepo.findByUserId(targetUserId);
    if (!targetProfile) {
      throw new HttpException(
        {
          code: ErrorCode.NOT_FOUND,
          message: 'Target user does not exist',
        },
        HttpStatus.NOT_FOUND
      );
    }

    return this.databaseService.withTransaction(async (tx) => {
      // 1. Create block relationship (idempotent via unique constraint)
      const { block, wasCreated } = await this.userBlocksRepo.createBlock(
        blockerUserId,
        targetUserId,
        reason,
        tx
      );

      // 2. Cascade match unmatching and conversation closure if an active match exists
      const [activeMatch] = await tx
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.status, 'ACTIVE'),
            or(
              and(eq(matches.userAId, blockerUserId), eq(matches.userBId, targetUserId)),
              and(eq(matches.userAId, targetUserId), eq(matches.userBId, blockerUserId))
            )
          )
        )
        .limit(1);

      if (activeMatch) {
        const now = new Date();
        // Unmatch
        await tx
          .update(matches)
          .set({
            status: 'UNMATCHED',
            unmatchedByUserId: blockerUserId,
            unmatchedAt: now,
            unmatchedReason: 'BLOCK',
            updatedAt: now,
          })
          .where(eq(matches.id, activeMatch.id));

        // Close associated conversation
        await tx
          .update(conversations)
          .set({
            status: 'CLOSED',
            updatedAt: now,
          })
          .where(eq(conversations.matchId, activeMatch.id));

        // Outbox event for conversation safety close
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'conversation.safety_closed',
          aggregateType: 'CONVERSATION',
          aggregateId: activeMatch.id,
          payload: {
            matchId: activeMatch.id,
            closedByUserId: blockerUserId,
            blockedUserId: targetUserId,
            reason: 'BLOCK',
            closedAt: now.toISOString(),
          },
          status: 'PENDING',
        });
      }

      // 3. Emit outbox and security telemetry events
      if (wasCreated) {
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'user.blocked',
          aggregateType: 'USER',
          aggregateId: blockerUserId,
          payload: {
            blockId: block.id,
            blockerUserId,
            blockedUserId: targetUserId,
            blockedAt: block.createdAt.toISOString(),
          },
          status: 'PENDING',
        });

        await tx.insert(securityEvents).values({
          id: generateUuidV7(),
          userId: blockerUserId,
          eventType: 'user.blocked',
          severity: 'INFO',
          metadata: {
            blockedUserId: targetUserId,
          },
        });
      }

      return {
        success: true,
        blockedUserId: targetUserId,
        createdAt: block.createdAt.toISOString(),
      };
    });
  }

  async unblockUser(blockerUserId: string, targetUserId: string): Promise<UnblockUserResponseDto> {
    if (blockerUserId === targetUserId) {
      throw new HttpException(
        {
          code: ErrorCode.BLOCK_SELF,
          message: 'A user cannot unblock themselves',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.databaseService.withTransaction(async (tx) => {
      const deleted = await this.userBlocksRepo.deleteBlock(blockerUserId, targetUserId, tx);
      if (!deleted) {
        throw new HttpException(
          {
            code: ErrorCode.BLOCK_NOT_FOUND,
            message: 'Block relationship not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      const now = new Date();
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'user.unblocked',
        aggregateType: 'USER',
        aggregateId: blockerUserId,
        payload: {
          blockerUserId,
          unblockedUserId: targetUserId,
          unblockedAt: now.toISOString(),
        },
        status: 'PENDING',
      });

      await tx.insert(securityEvents).values({
        id: generateUuidV7(),
        userId: blockerUserId,
        eventType: 'user.unblocked',
        severity: 'INFO',
        metadata: {
          unblockedUserId: targetUserId,
        },
      });

      return {
        success: true,
        unblockedUserId: targetUserId,
        unblockedAt: new Date().toISOString(),
      };
    });
  }

  async listBlockedUsers(
    blockerUserId: string,
    query: GetBlockedUsersQueryInput
  ): Promise<BlockedUserListResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeBlockCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      } else {
        throw new HttpException(
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid pagination cursor',
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const rows = await this.userBlocksRepo.findBlockedUsers(blockerUserId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: BlockedUserItemDto[] = pageRows.map((r) => ({
      blockedUserId: r.blockedUserId,
      displayName: r.displayName,
      age: calculateAge(r.dateOfBirth),
      city: r.city,
      primaryPhotoUrl: r.primaryObjectKey
        ? this.storageService.getPublicUrl(r.primaryObjectKey)
        : null,
      blockedAt: r.blockedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeBlockCursor({
          createdAt: last.blockedAt.toISOString(),
          id: last.blockId,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async blockContacts(
    userId: string,
    contacts: readonly { phoneHash: string; label?: string | null }[]
  ): Promise<BlockContactsResponseDto> {
    const { addedCount, totalCount } = await this.blockedContactsRepo.blockContacts(
      userId,
      contacts
    );

    // Emit security audit event
    await this.databaseService.client.insert(securityEvents).values({
      id: generateUuidV7(),
      userId,
      eventType: 'CONTACTS_BLOCKED',
      severity: 'INFO',
      metadata: { addedCount, totalBlockedCount: totalCount },
    });

    return {
      success: true,
      addedCount,
      totalBlockedCount: totalCount,
    };
  }

  async unblockContact(userId: string, phoneHash: string): Promise<{ success: boolean }> {
    const deleted = await this.blockedContactsRepo.unblockContact(userId, phoneHash);

    if (deleted) {
      await this.databaseService.client.insert(securityEvents).values({
        id: generateUuidV7(),
        userId,
        eventType: 'CONTACT_UNBLOCKED',
        severity: 'INFO',
        metadata: { phoneHash },
      });
    }

    return { success: deleted };
  }

  async listBlockedContacts(userId: string): Promise<BlockedContactsListResponseDto> {
    const rows = await this.blockedContactsRepo.listBlockedContacts(userId);
    return {
      items: rows.map((r) => ({
        id: r.id,
        phoneHash: r.phoneHash,
        label: r.label,
        createdAt: r.createdAt.toISOString(),
      })),
      totalCount: rows.length,
    };
  }
}
