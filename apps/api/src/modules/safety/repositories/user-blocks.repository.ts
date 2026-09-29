import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import { userBlocks, type UserBlockRow } from '../../../infrastructure/database/drizzle/schema/user-blocks.js';
import { profiles } from '../../../infrastructure/database/drizzle/schema/profiles.js';
import { profileMedia } from '../../../infrastructure/database/drizzle/schema/profile-media.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  IUserBlocksRepository,
  ListBlockedUsersOptions,
  BlockedUserQueryResult,
} from './user-blocks.repository.interface.js';

@Injectable()
export class UserBlocksRepository implements IUserBlocksRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createBlock(
    blockerUserId: string,
    blockedUserId: string,
    _reason?: string,
    tx?: DrizzleDatabase
  ): Promise<{ block: UserBlockRow; wasCreated: boolean }> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const result = await client
      .insert(userBlocks)
      .values({
        id,
        blockerUserId,
        blockedUserId,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [userBlocks.blockerUserId, userBlocks.blockedUserId],
      })
      .returning();

    if (result && result.length > 0 && result[0]) {
      return { block: result[0], wasCreated: true };
    }

    // Retrieve existing block
    const [existing] = await client
      .select()
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerUserId, blockerUserId),
          eq(userBlocks.blockedUserId, blockedUserId)
        )
      )
      .limit(1);

    return { block: existing!, wasCreated: false };
  }

  async deleteBlock(
    blockerUserId: string,
    blockedUserId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);

    const result = await client
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerUserId, blockerUserId),
          eq(userBlocks.blockedUserId, blockedUserId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async hasBlocked(
    blockerUserId: string,
    blockedUserId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);

    const [row] = await client
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerUserId, blockerUserId),
          eq(userBlocks.blockedUserId, blockedUserId)
        )
      )
      .limit(1);

    return Boolean(row);
  }

  async isBlockedBidirectional(
    userAId: string,
    userBId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);

    const [row] = await client
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        or(
          and(
            eq(userBlocks.blockerUserId, userAId),
            eq(userBlocks.blockedUserId, userBId)
          ),
          and(
            eq(userBlocks.blockerUserId, userBId),
            eq(userBlocks.blockedUserId, userAId)
          )
        )
      )
      .limit(1);

    return Boolean(row);
  }

  async findBlockedUsers(
    blockerUserId: string,
    options: ListBlockedUsersOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly BlockedUserQueryResult[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${userBlocks.createdAt} < ${options.cursor.createdAt} OR (${userBlocks.createdAt} = ${options.cursor.createdAt} AND ${userBlocks.id} < ${options.cursor.id}))`;
    }

    const rows = await client
      .select({
        blockedUserId: userBlocks.blockedUserId,
        displayName: sql<string>`COALESCE(${profiles.displayName}, 'User')`,
        dateOfBirth: profiles.dateOfBirth,
        city: profiles.city,
        primaryObjectKey: profileMedia.objectKey,
        blockedAt: userBlocks.createdAt,
        blockId: userBlocks.id,
      })
      .from(userBlocks)
      .leftJoin(profiles, eq(profiles.userId, userBlocks.blockedUserId))
      .leftJoin(
        profileMedia,
        and(
          eq(profileMedia.userId, userBlocks.blockedUserId),
          eq(profileMedia.isPrimary, true),
          eq(profileMedia.status, 'READY')
        )
      )
      .where(and(eq(userBlocks.blockerUserId, blockerUserId), cursorCondition))
      .orderBy(desc(userBlocks.createdAt), desc(userBlocks.id))
      .limit(options.limit);

    return rows;
  }

  async getAllBlockedUserIdsForUser(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly string[]> {
    const client = this.getClient(tx);

    const result = await client.execute(sql<{ userId: string }>`
      SELECT blocked_user_id AS "userId"
      FROM user_blocks
      WHERE blocker_user_id = ${userId}

      UNION

      SELECT blocker_user_id AS "userId"
      FROM user_blocks
      WHERE blocked_user_id = ${userId}
    `);

    const rows = (result.rows || result) as unknown as Array<{ userId: string }>;
    return rows.map((r) => r.userId);
  }
}
