import type { PostRow, NewPostRow } from '../../../infrastructure/database/drizzle/schema/posts.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface FeedCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface ListFeedOptions {
  readonly limit: number;
  readonly cursor?: FeedCursor;
  readonly communityId?: string;
  readonly excludedAuthorIds?: readonly string[];
}

export interface IPostsRepository {
  createPost(data: NewPostRow, tx?: DrizzleDatabase): Promise<PostRow>;
  findById(id: string, tx?: DrizzleDatabase): Promise<PostRow | null>;
  updatePost(id: string, data: Partial<NewPostRow>, tx?: DrizzleDatabase): Promise<PostRow | null>;
  softDeletePost(id: string, tx?: DrizzleDatabase): Promise<boolean>;
  incrementLikeCount(id: string, delta: number, tx?: DrizzleDatabase): Promise<void>;
  incrementCommentCount(id: string, delta: number, tx?: DrizzleDatabase): Promise<void>;
  findFeed(options: ListFeedOptions, tx?: DrizzleDatabase): Promise<readonly PostRow[]>;
}

export const POSTS_REPOSITORY_TOKEN = Symbol('IPostsRepository');
