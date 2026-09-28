import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
import { interests } from './interests.js';

export const profileInterests = pgTable(
  'profile_interests',
  {
    id: uuid('id').primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    interestId: uuid('interest_id')
      .notNull()
      .references(() => interests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_profile_interests_unique').on(table.profileId, table.interestId),
    index('idx_profile_interests_profile_id').on(table.profileId),
    index('idx_profile_interests_interest_id').on(table.interestId),
  ]
);

export type ProfileInterestRow = typeof profileInterests.$inferSelect;
export type NewProfileInterestRow = typeof profileInterests.$inferInsert;
