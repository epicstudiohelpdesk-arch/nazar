import { pgTable, uuid, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Notification Preferences Table
 * User-configurable notification settings for match, message, like, safety, and system events.
 * Safe server-side defaults are applied automatically.
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchNotificationsEnabled: boolean('match_notifications_enabled').notNull().default(true),
    messageNotificationsEnabled: boolean('message_notifications_enabled').notNull().default(true),
    likeNotificationsEnabled: boolean('like_notifications_enabled').notNull().default(true),
    safetyNotificationsEnabled: boolean('safety_notifications_enabled').notNull().default(true),
    systemNotificationsEnabled: boolean('system_notifications_enabled').notNull().default(true),
    messagePreviewEnabled: boolean('message_preview_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_notif_prefs_user_id').on(table.userId)]
);

export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferencesRow = typeof notificationPreferences.$inferInsert;
