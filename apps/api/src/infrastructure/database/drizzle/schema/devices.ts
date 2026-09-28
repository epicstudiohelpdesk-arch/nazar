import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Devices Table
 * Persists registered mobile/client devices for push notifications,
 * security trust scoring, and session tracking.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 16 }).notNull(), // 'ios' | 'android' | 'web'
    deviceModel: varchar('device_model', { length: 128 }),
    appVersion: varchar('app_version', { length: 32 }),
    pushToken: varchar('push_token', { length: 512 }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_devices_user_id').on(table.userId)]
);

export type DeviceRow = typeof devices.$inferSelect;
export type NewDeviceRow = typeof devices.$inferInsert;
