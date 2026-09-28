import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions.js';

/**
 * Session Token History Table
 * Stores SHA-256 hashes of rotated refresh tokens for replay detection.
 * If any token hash in this table is presented by a client on /refresh,
 * the entire session is instantly revoked and a security alert is triggered.
 */
export const sessionTokenHistory = pgTable(
  'session_token_history',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_session_token_history_lookup').on(table.sessionId, table.tokenHash),
    index('idx_session_token_history_token_hash').on(table.tokenHash),
  ]
);

export type SessionTokenHistoryRow = typeof sessionTokenHistory.$inferSelect;
export type NewSessionTokenHistoryRow = typeof sessionTokenHistory.$inferInsert;
