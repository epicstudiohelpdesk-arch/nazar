import {
  pgTable,
  uuid,
  integer,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { users } from './users.js';

export const profilePreferences = pgTable(
  'profile_preferences',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    minAge: integer('min_age').notNull().default(18),
    maxAge: integer('max_age').notNull().default(99),
    genderPreferences: jsonb('gender_preferences').notNull().$type<Gender[]>(),
    maxDistanceKm: integer('max_distance_km').notNull().default(50),
    relationshipIntent: varchar('relationship_intent', { length: 32 })
      .notNull()
      .default('LONG_TERM')
      .$type<RelationshipIntent>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_profile_preferences_user_id').on(table.userId)]
);

export type ProfilePreferencesRow = typeof profilePreferences.$inferSelect;
export type NewProfilePreferencesRow = typeof profilePreferences.$inferInsert;
