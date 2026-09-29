import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { notifications } from './notifications.js';
import { devices } from './devices.js';

/**
 * Notification Delivery Jobs Table
 * Asynchronous delivery queue for push notification workers (APNs / FCM).
 * Supports exponential backoff, worker lease timeouts, and per-device status tracking.
 */
export const notificationDeliveryJobs = pgTable(
  'notification_delivery_jobs',
  {
    id: uuid('id').primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRYING' | 'CANCELLED'
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    availableAt: timestamp('available_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
    lockedBy: varchar('locked_by', { length: 128 }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }),
    provider: varchar('provider', { length: 16 }).notNull(), // 'APNS' | 'FCM'
    providerMessageId: varchar('provider_message_id', { length: 256 }),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    lastErrorMessage: text('last_error_message'),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_delivery_jobs_notif_device').on(table.notificationId, table.deviceId),
    index('idx_delivery_jobs_status_available').on(table.status, table.availableAt),
    index('idx_delivery_jobs_device').on(table.deviceId),
    index('idx_delivery_jobs_locked').on(table.status, table.lockedAt),
  ]
);

export type NotificationDeliveryJobRow = typeof notificationDeliveryJobs.$inferSelect;
export type NewNotificationDeliveryJobRow = typeof notificationDeliveryJobs.$inferInsert;
