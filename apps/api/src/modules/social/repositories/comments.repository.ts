import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, asc, isNull, notInArray } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  postComments,
  type PostCommentRow,
  type NewPostCommentRow,
} from '../../../infrastructure/database/drizzle/schema/posts.js';
import type { ICommentsRepository, ListCommentsOptions } from './comments.repository.interface.js';

@Injectable()
export class CommentsRepository implements ICommentsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createComment(data: NewPostCommentRow, tx?: DrizzleDatabase): Promise<PostCommentRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(postComments).values(data).returning();
    return row!;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<PostCommentRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(postComments)
      .where(and(eq(postComments.id, id), isNull(postComments.deletedAt)))
      .limit(1);
    return row || null;
  }

  async updateComment(
    id: string,
    content: string,
    tx?: DrizzleDatabase
  ): Promise<PostCommentRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(postComments)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(postComments.id, id), isNull(postComments.deletedAt)))
      .returning();
    return row || null;
  }

  async softDeleteComment(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(postComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(postComments.id, id), isNull(postComments.deletedAt)))
      .returning();
    return result.length > 0;
  }

  async findByPostId(
    postId: string,
    options: ListCommentsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly PostCommentRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${postComments.createdAt} > ${options.cursor.createdAt} OR (${postComments.createdAt} = ${options.cursor.createdAt} AND ${postComments.id} > ${options.cursor.id}))`;
    }

    const conditions = [
      eq(postComments.postId, postId),
      isNull(postComments.deletedAt),
      cursorCondition,
    ];

    if (options.excludedAuthorIds && options.excludedAuthorIds.length > 0) {
      conditions.push(notInArray(postComments.authorId, [...options.excludedAuthorIds]));
    }

    return client
      .select()
      .from(postComments)
      .where(and(...conditions))
      .orderBy(asc(postComments.createdAt), asc(postComments.id))
      .limit(options.limit);
  }
}
