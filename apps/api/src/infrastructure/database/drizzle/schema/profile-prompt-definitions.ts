import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const profilePromptDefinitions = pgTable(
  'profile_prompt_definitions',
  {
    id: uuid('id').primaryKey(),
    prompt: varchar('prompt', { length: 255 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_prompt_definitions_status').on(table.status)]
);

export type ProfilePromptDefinitionRow = typeof profilePromptDefinitions.$inferSelect;
export type NewProfilePromptDefinitionRow = typeof profilePromptDefinitions.$inferInsert;
