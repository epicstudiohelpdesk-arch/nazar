import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Entitlements Table
 * The authoritative server-side record of features unlocked for each user.
 * Active validity is time-aware: starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()) AND revoked_at IS NULL.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entitlementCode: varchar('entitlement_code', { length: 64 }).notNull(), // 'PREMIUM' | 'SEE_LIKES' | 'UNLIMITED_LIKES' | 'ADVANCED_DISCOVERY' | 'PROFILE_BOOST' | 'UNLIMITED_REWINDS'
    sourceType: varchar('source_type', { length: 32 }).notNull(), // 'SUBSCRIPTION' | 'ONE_TIME_PURCHASE' | 'PROMOTION' | 'ADMIN_GRANT' | 'SYSTEM'
    sourceId: varchar('source_id', { length: 255 }), // e.g. subscriptionId or transactionId
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'EXPIRED' | 'REVOKED'
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }), // null = permanent/lifetime
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_entitlements_user_code').on(table.userId, table.entitlementCode),
    index('idx_entitlements_user_expires').on(table.userId, table.expiresAt),
    index('idx_entitlements_user_revoked').on(table.userId, table.revokedAt),
    index('idx_entitlements_source').on(table.sourceType, table.sourceId),
  ]
);

export type EntitlementRow = typeof entitlements.$inferSelect;
export type NewEntitlementRow = typeof entitlements.$inferInsert;
