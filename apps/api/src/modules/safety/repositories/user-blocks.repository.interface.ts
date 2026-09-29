import type { UserBlockRow } from '../../../infrastructure/database/drizzle/schema/user-blocks.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface BlockedUserQueryResult {
  readonly blockedUserId: string;
  readonly displayName: string;
  readonly dateOfBirth: string | null;
  readonly city: string | null;
  readonly primaryObjectKey: string | null;
  readonly blockedAt: Date;
  readonly blockId: string;
}

export interface ListBlockedUsersOptions {
  readonly limit: number;
  readonly cursor?: {
    readonly createdAt: Date;
    readonly id: string;
  };
}

export interface IUserBlocksRepository {
  createBlock(
    blockerUserId: string,
    blockedUserId: string,
    reason?: string,
    tx?: DrizzleDatabase
  ): Promise<{ block: UserBlockRow; wasCreated: boolean }>;

  deleteBlock(blockerUserId: string, blockedUserId: string, tx?: DrizzleDatabase): Promise<boolean>;

  hasBlocked(blockerUserId: string, blockedUserId: string, tx?: DrizzleDatabase): Promise<boolean>;

  isBlockedBidirectional(userAId: string, userBId: string, tx?: DrizzleDatabase): Promise<boolean>;

  findBlockedUsers(
    blockerUserId: string,
    options: ListBlockedUsersOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly BlockedUserQueryResult[]>;

  getAllBlockedUserIdsForUser(userId: string, tx?: DrizzleDatabase): Promise<readonly string[]>;
}

export const USER_BLOCKS_REPOSITORY_TOKEN = Symbol('IUserBlocksRepository');
