import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Idempotency Keys Table
 * Durable storage for mutation deduplication and replay protection.
 * Compound PK (scope, key) guarantees no race conditions can produce duplicate writes.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 255 }).notNull(),
    scope: varchar('scope', { length: 128 }).notNull().default('global'),
    requestFingerprint: varchar('request_fingerprint', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(), // 'STARTED' | 'COMPLETED' | 'FAILED'
    statusCode: integer('status_code'),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.key] }),
    index('idx_idempotency_keys_expires_at').on(table.expiresAt),
  ]
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKeyRow = typeof idempotencyKeys.$inferInsert;
