import type {
  PostCommentRow,
  NewPostCommentRow,
} from '../../../infrastructure/database/drizzle/schema/posts.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface CommentCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface ListCommentsOptions {
  readonly limit: number;
  readonly cursor?: CommentCursor;
  readonly excludedAuthorIds?: readonly string[];
}

export interface ICommentsRepository {
  createComment(data: NewPostCommentRow, tx?: DrizzleDatabase): Promise<PostCommentRow>;
  findById(id: string, tx?: DrizzleDatabase): Promise<PostCommentRow | null>;
  updateComment(id: string, content: string, tx?: DrizzleDatabase): Promise<PostCommentRow | null>;
  softDeleteComment(id: string, tx?: DrizzleDatabase): Promise<boolean>;
  findByPostId(
    postId: string,
    options: ListCommentsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly PostCommentRow[]>;
}

export const COMMENTS_REPOSITORY_TOKEN = Symbol('ICommentsRepository');
