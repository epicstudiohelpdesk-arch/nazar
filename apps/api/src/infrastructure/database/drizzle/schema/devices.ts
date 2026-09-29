import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Devices Table
 * Persists registered mobile/client devices for push notifications (APNs / FCM),
 * security trust scoring, and session tracking.
 * Supports multiple active devices per user, token rotation, and account switching.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 16 }).notNull(), // 'IOS' | 'ANDROID'
    pushProvider: varchar('push_provider', { length: 16 }).notNull().default('APNS'), // 'APNS' | 'FCM'
    pushToken: text('push_token'),
    deviceIdentifier: varchar('device_identifier', { length: 256 }),
    deviceModel: varchar('device_model', { length: 128 }),
    appVersion: varchar('app_version', { length: 32 }),
    osVersion: varchar('os_version', { length: 32 }),
    locale: varchar('locale', { length: 32 }),
    timezone: varchar('timezone', { length: 64 }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_devices_user_id').on(table.userId),
    index('idx_devices_platform_provider').on(table.platform, table.pushProvider),
    index('idx_devices_push_token').on(table.pushToken),
    index('idx_devices_identifier').on(table.deviceIdentifier),
    index('idx_devices_user_revoked').on(table.userId, table.revokedAt),
  ]
);

export type DeviceRow = typeof devices.$inferSelect;
export type NewDeviceRow = typeof devices.$inferInsert;
