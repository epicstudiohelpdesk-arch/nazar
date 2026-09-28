import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export type PasskeyChallengePurpose = 'registration' | 'authentication';

/**
 * Passkey Challenges Table
 * Ephemeral challenges for WebAuthn registration and authentication.
 * Single-use enforced via consumed_at timestamp.
 */
export const passkeyChallenges = pgTable(
  'passkey_challenges',
  {
    id: uuid('id').primaryKey(),
    challenge: varchar('challenge', { length: 255 }).notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 32 }).$type<PasskeyChallengePurpose>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_passkey_challenges_challenge').on(table.challenge),
    index('idx_passkey_challenges_expires_at').on(table.expiresAt),
  ]
);

export type PasskeyChallengeRow = typeof passkeyChallenges.$inferSelect;
export type NewPasskeyChallengeRow = typeof passkeyChallenges.$inferInsert;
