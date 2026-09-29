import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { communities } from './communities.js';

/**
 * Social Posts Table (Gate 12)
 * Posts published by users either globally or within a specific community.
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    mediaIds: jsonb('media_ids').$type<string[]>(),
    visibility: varchar('visibility', { length: 32 }).notNull().default('PUBLIC'), // 'PUBLIC' | 'COMMUNITY' | 'FOLLOWERS'
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_posts_author').on(table.authorId),
    index('idx_posts_community').on(table.communityId),
    index('idx_posts_created_at').on(table.createdAt),
    index('idx_posts_visibility').on(table.visibility),
    check('chk_posts_visibility', sql`${table.visibility} IN ('PUBLIC', 'COMMUNITY', 'FOLLOWERS')`),
  ]
);

export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;

/**
 * Post Comments Table (Gate 12)
 * Discussion comments and replies on social posts.
 */
export const postComments = pgTable(
  'post_comments',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => postComments.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_post_comments_post').on(table.postId),
    index('idx_post_comments_author').on(table.authorId),
    index('idx_post_comments_parent').on(table.parentId),
    index('idx_post_comments_created_at').on(table.createdAt),
  ]
);

export type PostCommentRow = typeof postComments.$inferSelect;
export type NewPostCommentRow = typeof postComments.$inferInsert;

/**
 * Post Reactions Table (Gate 12)
 * Rich emoji reactions to posts with idempotent unique constraint.
 */
export const postReactions = pgTable(
  'post_reactions',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reactionType: varchar('reaction_type', { length: 32 }).notNull(), // 'LIKE' | 'LOVE' | 'CELEBRATE' | 'SUPPORT' | 'LAUGH'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_post_reactions_unique').on(table.postId, table.userId, table.reactionType),
    index('idx_post_reactions_post').on(table.postId),
    index('idx_post_reactions_user').on(table.userId),
    check(
      'chk_post_reactions_type',
      sql`${table.reactionType} IN ('LIKE', 'LOVE', 'CELEBRATE', 'SUPPORT', 'LAUGH')`
    ),
  ]
);

export type PostReactionRow = typeof postReactions.$inferSelect;
export type NewPostReactionRow = typeof postReactions.$inferInsert;
