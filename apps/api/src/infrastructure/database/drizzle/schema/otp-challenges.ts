import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export type OtpIdentifierType = 'PHONE' | 'EMAIL';

/**
 * OTP Challenges Table
 * Manages short-lived phone and email verification challenges.
 * Security Invariants:
 *  - Plaintext OTP is NEVER stored (only SHA-256 hash with cryptographic salt).
 *  - Single-use enforced via consumed_at timestamp.
 *  - Max attempts enforced before verification threshold.
 */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    identifierType: varchar('identifier_type', { length: 16 }).$type<OtpIdentifierType>().notNull(),
    otpHash: varchar('otp_hash', { length: 64 }).notNull(),
    salt: varchar('salt', { length: 32 }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    ipAddress: varchar('ip_address', { length: 64 }),
    deviceId: varchar('device_id', { length: 128 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_otp_challenges_identifier').on(table.identifier, table.identifierType),
    index('idx_otp_challenges_expires_at').on(table.expiresAt),
  ]
);

export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type NewOtpChallengeRow = typeof otpChallenges.$inferInsert;
