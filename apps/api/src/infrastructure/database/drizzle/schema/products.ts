import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Products Table
 * Canonical catalog of purchasable items and subscription plans.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 64 }).notNull().unique(), // e.g. 'PREMIUM_MONTHLY', 'PREMIUM_ANNUAL', 'BOOST_ONE_TIME'
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    productType: varchar('product_type', { length: 32 }).notNull(), // 'SUBSCRIPTION' | 'ONE_TIME' | 'CONSUMABLE' | 'NON_CONSUMABLE'
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
    durationDays: integer('duration_days'), // e.g. 30, 365, or null for one-time purchases
    basePriceMinor: integer('base_price_minor').notNull().default(0), // in minor units (e.g. paise for INR)
    baseCurrency: varchar('base_currency', { length: 3 }).notNull().default('INR'), // ISO-4217
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_products_status').on(table.status),
    index('idx_products_product_type').on(table.productType),
  ]
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;

/**
 * Product Provider Mappings Table
 * Maps canonical internal products to external store IDs (Apple App Store & Google Play).
 */
export const productProviderMappings = pgTable(
  'product_provider_mappings',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // 'APPLE_APP_STORE' | 'GOOGLE_PLAY' | 'MOCK'
    providerProductId: varchar('provider_product_id', { length: 128 }).notNull(), // e.g. 'com.nazar.premium.monthly'
    environment: varchar('environment', { length: 32 }).notNull().default('PRODUCTION'), // 'SANDBOX' | 'PRODUCTION'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_product_provider_env').on(table.provider, table.providerProductId, table.environment),
    index('idx_product_provider_mapping_product_id').on(table.productId),
  ]
);

export type ProductProviderMappingRow = typeof productProviderMappings.$inferSelect;
export type NewProductProviderMappingRow = typeof productProviderMappings.$inferInsert;

/**
 * Product Entitlements Table
 * Associates products with the specific feature entitlements they grant.
 */
export const productEntitlements = pgTable(
  'product_entitlements',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    entitlementCode: varchar('entitlement_code', { length: 64 }).notNull(), // e.g. 'PREMIUM', 'SEE_LIKES', 'UNLIMITED_LIKES'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_product_entitlement_unique').on(table.productId, table.entitlementCode),
    index('idx_product_entitlement_product_id').on(table.productId),
    index('idx_product_entitlement_code').on(table.entitlementCode),
  ]
);

export type ProductEntitlementRow = typeof productEntitlements.$inferSelect;
export type NewProductEntitlementRow = typeof productEntitlements.$inferInsert;
