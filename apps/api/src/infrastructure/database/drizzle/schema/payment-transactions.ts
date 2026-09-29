import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { products } from './products.js';
import { subscriptions } from './subscriptions.js';

/**
 * Payment Transactions Table
 * Durable financial ledger of purchases, renewals, refunds, and revocations.
 * Stores monetary amounts in integer minor units (e.g. paise) to eliminate floating-point rounding errors.
 */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    provider: varchar('provider', { length: 32 }).notNull(), // 'APPLE_APP_STORE' | 'GOOGLE_PLAY' | 'MOCK'
    providerTransactionId: varchar('provider_transaction_id', { length: 255 }).notNull(), // Apple transactionId or Google order ID
    providerOriginalTransactionId: varchar('provider_original_transaction_id', { length: 255 }),
    transactionType: varchar('transaction_type', { length: 32 }).notNull(), // 'INITIAL_PURCHASE' | 'RENEWAL' | 'UPGRADE' | 'DOWNGRADE' | 'RESTORE' | 'REFUND' | 'REVOCATION' | 'RENEWAL_FAILURE'
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'DISPUTED'
    amountMinor: integer('amount_minor').notNull().default(0), // minor units (e.g. 19900 = ₹199.00)
    currency: varchar('currency', { length: 3 }).notNull().default('INR'), // ISO-4217
    providerCreatedAt: timestamp('provider_created_at', { withTimezone: true, mode: 'date' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    providerMetadata: jsonb('provider_metadata').default('{}'), // redacted metadata (no credentials, cards, CVV, or PII)
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_payment_tx_user_created').on(table.userId, table.createdAt),
    uniqueIndex('idx_payment_tx_provider_tx_id').on(table.provider, table.providerTransactionId),
    index('idx_payment_tx_sub_created').on(table.subscriptionId, table.createdAt),
  ]
);

export type PaymentTransactionRow = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransactionRow = typeof paymentTransactions.$inferInsert;
