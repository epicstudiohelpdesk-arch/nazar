import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Blocked Contacts Table (Gate 09 Privacy Enhancement - Feature 2.1)
 * Stores SHA-256 hashed phone numbers from address books or manual entry.
 * Never stores plaintext phone numbers, guaranteeing zero knowledge of user contact lists.
 */
export const blockedContacts = pgTable(
  'blocked_contacts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    phoneHash: varchar('phone_hash', { length: 64 }).notNull(),
    label: varchar('label', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_blocked_contacts_user_phone_hash').on(table.userId, table.phoneHash),
    index('idx_blocked_contacts_user_id').on(table.userId),
    index('idx_blocked_contacts_phone_hash').on(table.phoneHash),
  ]
);

export type BlockedContactRow = typeof blockedContacts.$inferSelect;
export type NewBlockedContactRow = typeof blockedContacts.$inferInsert;
