import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * User Blocks Table
 * Durable record of directional block relationships between users.
 * Supports bidirectional discovery exclusion, interaction prevention, and conversation closure.
 */
export const userBlocks = pgTable(
  'user_blocks',
  {
    id: uuid('id').primaryKey(),
    blockerUserId: uuid('blocker_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    blockedUserId: uuid('blocked_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_user_blocks_blocker_blocked').on(table.blockerUserId, table.blockedUserId),
    index('idx_user_blocks_blocked_user').on(table.blockedUserId),
    index('idx_user_blocks_blocker_created').on(table.blockerUserId, table.createdAt),
  ]
);

export type UserBlockRow = typeof userBlocks.$inferSelect;
export type NewUserBlockRow = typeof userBlocks.$inferInsert;
