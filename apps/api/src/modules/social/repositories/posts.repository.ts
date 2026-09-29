import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc, isNull, notInArray } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  posts,
  type PostRow,
  type NewPostRow,
} from '../../../infrastructure/database/drizzle/schema/posts.js';
import type { IPostsRepository, ListFeedOptions } from './posts.repository.interface.js';

@Injectable()
export class PostsRepository implements IPostsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createPost(data: NewPostRow, tx?: DrizzleDatabase): Promise<PostRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(posts).values(data).returning();
    return row!;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<PostRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .limit(1);
    return row || null;
  }

  async updatePost(
    id: string,
    data: Partial<NewPostRow>,
    tx?: DrizzleDatabase
  ): Promise<PostRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .returning();
    return row || null;
  }

  async softDeletePost(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(posts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      .returning();
    return result.length > 0;
  }

  async incrementLikeCount(id: string, delta: number, tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(posts)
      .set({
        likeCount: sql`GREATEST(0, ${posts.likeCount} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  async incrementCommentCount(id: string, delta: number, tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(posts)
      .set({
        commentCount: sql`GREATEST(0, ${posts.commentCount} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  async findFeed(options: ListFeedOptions, tx?: DrizzleDatabase): Promise<readonly PostRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${posts.createdAt} < ${options.cursor.createdAt} OR (${posts.createdAt} = ${options.cursor.createdAt} AND ${posts.id} < ${options.cursor.id}))`;
    }

    const conditions = [isNull(posts.deletedAt), cursorCondition];

    if (options.communityId) {
      conditions.push(eq(posts.communityId, options.communityId));
    }

    if (options.excludedAuthorIds && options.excludedAuthorIds.length > 0) {
      conditions.push(notInArray(posts.authorId, [...options.excludedAuthorIds]));
    }

    return client
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(options.limit);
  }
}
