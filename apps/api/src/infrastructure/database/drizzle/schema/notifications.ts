import { pgTable, uuid, varchar, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Notifications Table
 * Durable in-app notification records for user feed, badge counts, and history.
 * Supports deterministic deduplication against source outbox events.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceEventId: uuid('source_event_id'),
    type: varchar('type', { length: 64 }).notNull(), // 'NEW_MATCH' | 'NEW_MESSAGE' | 'NEW_LIKE' | 'SYSTEM_NOTICE' | 'SECURITY_ALERT' | 'ACCOUNT_RESTRICTION'
    title: varchar('title', { length: 256 }).notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    priority: varchar('priority', { length: 16 }).notNull().default('NORMAL'), // 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_created').on(table.userId, table.createdAt),
    index('idx_notifications_user_read').on(table.userId, table.readAt),
    index('idx_notifications_user_type').on(table.userId, table.type),
    index('idx_notifications_expires').on(table.expiresAt),
    uniqueIndex('idx_notifications_event_user_type').on(table.sourceEventId, table.userId, table.type),
  ]
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
