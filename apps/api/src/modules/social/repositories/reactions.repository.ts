import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  postReactions,
  type PostReactionRow,
} from '../../../infrastructure/database/drizzle/schema/posts.js';
import { generateUuidV7 } from '@platform/domain';
import type { IReactionsRepository, ReactionCountItem } from './reactions.repository.interface.js';

@Injectable()
export class ReactionsRepository implements IReactionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async upsertReaction(
    postId: string,
    userId: string,
    reactionType: string,
    tx?: DrizzleDatabase
  ): Promise<{ reaction: PostReactionRow; wasCreated: boolean }> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const result = await client
      .insert(postReactions)
      .values({
        id,
        postId,
        userId,
        reactionType,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [postReactions.postId, postReactions.userId, postReactions.reactionType],
      })
      .returning();

    if (result && result.length > 0 && result[0]) {
      return { reaction: result[0], wasCreated: true };
    }

    const [existing] = await client
      .select()
      .from(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.userId, userId),
          eq(postReactions.reactionType, reactionType)
        )
      )
      .limit(1);

    return { reaction: existing!, wasCreated: false };
  }

  async deleteReaction(
    postId: string,
    userId: string,
    reactionType: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .delete(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.userId, userId),
          eq(postReactions.reactionType, reactionType)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getUserReaction(
    postId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<PostReactionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)))
      .limit(1);
    return row || null;
  }

  async getReactionCounts(
    postId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly ReactionCountItem[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        reactionType: postReactions.reactionType,
        count: sql<number>`count(*)::int`,
      })
      .from(postReactions)
      .where(eq(postReactions.postId, postId))
      .groupBy(postReactions.reactionType);

    return rows;
  }
}
