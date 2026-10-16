import { pgTable, uuid, varchar, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Matches Table (Gate 07)
 * Canonical mutual match entity.
 * Stores normalized user pairs (userAId < userBId) with database-enforced uniqueness
 * to guarantee concurrency safety and prevent duplicate matches.
 */
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'QUEUED' | 'EXPIRED' | 'UNMATCHED'
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    matchedAt: timestamp('matched_at', { withTimezone: true }).defaultNow().notNull(),
    unmatchedByUserId: uuid('unmatched_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    unmatchedAt: timestamp('unmatched_at', { withTimezone: true }),
    unmatchedReason: varchar('unmatched_reason', { length: 256 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_matches_user_a_user_b').on(table.userAId, table.userBId),
    index('idx_matches_user_a_status').on(table.userAId, table.status),
    index('idx_matches_user_b_status').on(table.userBId, table.status),
    index('idx_matches_status_matched_at').on(table.status, table.matchedAt),
    index('idx_matches_status_expires_at').on(table.status, table.expiresAt),
    check('chk_matches_normalized_pair', sql`${table.userAId} < ${table.userBId}`),
    check(
      'chk_matches_status',
      sql`${table.status} IN ('ACTIVE', 'QUEUED', 'EXPIRED', 'UNMATCHED')`
    ),
  ]
);

export type MatchRow = typeof matches.$inferSelect;
export type NewMatchRow = typeof matches.$inferInsert;
