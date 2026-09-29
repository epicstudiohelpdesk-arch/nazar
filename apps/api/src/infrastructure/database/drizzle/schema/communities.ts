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
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Communities Table (Gate 12)
 * Community spaces for shared interests and discussions.
 */
export const communities = pgTable(
  'communities',
  {
    id: uuid('id').primaryKey(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description').notNull(),
    avatarMediaId: uuid('avatar_media_id'),
    coverMediaId: uuid('cover_media_id'),
    privacy: varchar('privacy', { length: 32 }).notNull().default('PUBLIC'), // 'PUBLIC' | 'PRIVATE' | 'HIDDEN'
    memberCount: integer('member_count').notNull().default(1),
    rules: jsonb('rules').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_communities_slug').on(table.slug),
    uniqueIndex('idx_communities_name').on(table.name),
    index('idx_communities_creator').on(table.creatorId),
    index('idx_communities_privacy').on(table.privacy),
    index('idx_communities_created_at').on(table.createdAt),
    check('chk_communities_privacy', sql`${table.privacy} IN ('PUBLIC', 'PRIVATE', 'HIDDEN')`),
  ]
);

export type CommunityRow = typeof communities.$inferSelect;
export type NewCommunityRow = typeof communities.$inferInsert;

/**
 * Community Memberships Table (Gate 12)
 * Tracks user membership, approval status, and moderator roles within communities.
 */
export const communityMemberships = pgTable(
  'community_memberships',
  {
    id: uuid('id').primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('MEMBER'), // 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'PENDING' | 'BANNED' | 'LEFT'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_community_members_unique').on(table.communityId, table.userId),
    index('idx_community_members_user').on(table.userId),
    index('idx_community_members_comm_status').on(table.communityId, table.status),
    check(
      'chk_community_member_role',
      sql`${table.role} IN ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')`
    ),
    check(
      'chk_community_member_status',
      sql`${table.status} IN ('ACTIVE', 'PENDING', 'BANNED', 'LEFT')`
    ),
  ]
);

export type CommunityMembershipRow = typeof communityMemberships.$inferSelect;
export type NewCommunityMembershipRow = typeof communityMemberships.$inferInsert;
