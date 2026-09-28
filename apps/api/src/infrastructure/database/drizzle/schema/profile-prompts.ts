import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
import { profilePromptDefinitions } from './profile-prompt-definitions.js';

export const profilePrompts = pgTable(
  'profile_prompts',
  {
    id: uuid('id').primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    promptDefinitionId: uuid('prompt_definition_id')
      .notNull()
      .references(() => profilePromptDefinitions.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_profile_prompts_unique').on(table.profileId, table.promptDefinitionId),
    index('idx_profile_prompts_profile_id').on(table.profileId),
  ]
);

export type ProfilePromptRow = typeof profilePrompts.$inferSelect;
export type NewProfilePromptRow = typeof profilePrompts.$inferInsert;
