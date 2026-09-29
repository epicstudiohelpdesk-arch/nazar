import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { moderationCases } from './moderation-cases.js';

/**
 * User Restrictions Table
 * Explicit, structured safety enforcements applied to user accounts.
 * Supports temporary and permanent restrictions across profile visibility, discovery,
 * interactions (likes), messaging, login, and full account suspension/ban.
 */
export const userRestrictions = pgTable(
  'user_restrictions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    restrictionType: varchar('restriction_type', { length: 64 }).notNull(), // 'PROFILE_VISIBILITY' | 'DISCOVERY' | 'LIKES' | 'MESSAGING' | 'ACCOUNT_LOGIN' | 'FULL_ACCOUNT'
    sourceCaseId: uuid('source_case_id').references(() => moderationCases.id, {
      onDelete: 'set null',
    }),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }), // null = permanent
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revokedByUserId: uuid('revoked_by_user_id'),
  },
  (table) => [
    index('idx_user_restrictions_active').on(
      table.userId,
      table.restrictionType,
      table.revokedAt,
      table.expiresAt
    ),
    index('idx_user_restrictions_type').on(table.restrictionType),
  ]
);

export type UserRestrictionRow = typeof userRestrictions.$inferSelect;
export type NewUserRestrictionRow = typeof userRestrictions.$inferInsert;
