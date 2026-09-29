import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { products } from './products.js';

/**
 * Subscriptions Table
 * Represents ongoing recurring billing relationships between users and store providers.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    provider: varchar('provider', { length: 32 }).notNull(), // 'APPLE_APP_STORE' | 'GOOGLE_PLAY' | 'MOCK'
    providerSubscriptionId: varchar('provider_subscription_id', { length: 255 }), // e.g. Google purchase token
    providerOriginalTransactionId: varchar('provider_original_transaction_id', {
      length: 255,
    }).notNull(), // Apple originalTransactionId or Google order ID
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // 'PENDING' | 'ACTIVE' | 'GRACE_PERIOD' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'REVOKED' | 'REFUNDED'
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    autoRenewEnabled: boolean('auto_renew_enabled').notNull().default(true),
    gracePeriodUntil: timestamp('grace_period_until', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_subscriptions_user_id').on(table.userId),
    uniqueIndex('idx_subscriptions_provider_orig_tx').on(
      table.provider,
      table.providerOriginalTransactionId
    ),
    index('idx_subscriptions_provider_sub_id').on(table.provider, table.providerSubscriptionId),
    index('idx_subscriptions_status_expires').on(table.status, table.expiresAt),
  ]
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
