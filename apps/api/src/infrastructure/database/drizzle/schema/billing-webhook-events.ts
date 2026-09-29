import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Billing Webhook Events Table
 * Durable, idempotent log of incoming store provider webhooks (Apple App Store Server Notifications & Google Play RTDN).
 * Enforces provider + providerEventId uniqueness to ensure single-flight processing.
 */
export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: uuid('id').primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(), // 'APPLE_APP_STORE' | 'GOOGLE_PLAY' | 'MOCK'
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(), // SHA-256 hex digest
    rawPayload: jsonb('raw_payload').notNull(), // payload with credentials stripped
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED'
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_billing_webhook_provider_event_id').on(table.provider, table.providerEventId),
    index('idx_billing_webhook_status_created').on(table.status, table.createdAt),
  ]
);

export type BillingWebhookEventRow = typeof billingWebhookEvents.$inferSelect;
export type NewBillingWebhookEventRow = typeof billingWebhookEvents.$inferInsert;
