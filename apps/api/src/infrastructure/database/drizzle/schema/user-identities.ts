import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export type IdentityProviderType = 'PHONE' | 'EMAIL' | 'GOOGLE' | 'APPLE';

/**
 * User Identities Table
 * Decouples authentication providers from the canonical user entity.
 * Invariant: One physical user can possess multiple provider identities,
 * but no identity may belong to more than one user.
 */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).$type<IdentityProviderType>().notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    emailVerified: boolean('email_verified').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    unique('uq_user_identities_provider_subject').on(table.provider, table.providerSubject),
    index('idx_user_identities_user_id').on(table.userId),
  ]
);

export type UserIdentityRow = typeof userIdentities.$inferSelect;
export type NewUserIdentityRow = typeof userIdentities.$inferInsert;
