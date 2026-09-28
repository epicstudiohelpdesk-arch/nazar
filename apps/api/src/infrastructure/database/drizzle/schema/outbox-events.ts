import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Outbox Events Table
 * Transactional outbox table for reliable asynchronous side-effect dispatch.
 * Decouples database mutations from queue workers and push notifications.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 64 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_outbox_events_status_available').on(table.status, table.availableAt),
    index('idx_outbox_events_aggregate').on(table.aggregateType, table.aggregateId),
  ]
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEventRow = typeof outboxEvents.$inferInsert;
