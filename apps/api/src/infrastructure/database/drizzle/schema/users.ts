import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

/**
 * Users Table
 * Authoritative entity for identity and lifecycle management.
 * Primary key uses RFC 9562 UUIDv7 generated application-side.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
