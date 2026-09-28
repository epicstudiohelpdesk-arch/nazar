import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Passkeys Table
 * Persists WebAuthn / FIDO2 public key credentials.
 * Security Invariant: Private keys remain strictly on the user's client authenticator.
 */
export const passkeys = pgTable(
  'passkeys',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: varchar('credential_id', { length: 512 }).notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    deviceType: varchar('device_type', { length: 32 }),
    backedUp: boolean('backed_up').notNull().default(false),
    transports: jsonb('transports').$type<string[]>(),
    aaguid: varchar('aaguid', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_passkeys_user_id').on(table.userId),
    index('idx_passkeys_credential_id').on(table.credentialId),
  ]
);

export type PasskeyRow = typeof passkeys.$inferSelect;
export type NewPasskeyRow = typeof passkeys.$inferInsert;
