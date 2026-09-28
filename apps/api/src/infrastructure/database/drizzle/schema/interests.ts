import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const interests = pgTable(
  'interests',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    category: varchar('category', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_interests_slug').on(table.slug),
    index('idx_interests_status').on(table.status),
  ]
);

export type InterestRow = typeof interests.$inferSelect;
export type NewInterestRow = typeof interests.$inferInsert;
