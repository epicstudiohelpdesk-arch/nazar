import type { PostReactionRow } from '../../../infrastructure/database/drizzle/schema/posts.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface ReactionCountItem {
  readonly reactionType: string;
  readonly count: number;
}

export interface IReactionsRepository {
  upsertReaction(
    postId: string,
    userId: string,
    reactionType: string,
    tx?: DrizzleDatabase
  ): Promise<{ reaction: PostReactionRow; wasCreated: boolean }>;

  deleteReaction(
    postId: string,
    userId: string,
    reactionType: string,
    tx?: DrizzleDatabase
  ): Promise<boolean>;

  getUserReaction(
    postId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<PostReactionRow | null>;

  getReactionCounts(postId: string, tx?: DrizzleDatabase): Promise<readonly ReactionCountItem[]>;
}

export const REACTIONS_REPOSITORY_TOKEN = Symbol('IReactionsRepository');
