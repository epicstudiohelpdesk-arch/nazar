import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import type { DateCheckinStatus } from '@platform/api-contracts';
import { users } from './users.js';
import { matches } from './matches.js';

export const dateCheckins = pgTable(
  'date_checkins',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    meetingLocation: varchar('meeting_location', { length: 255 }).notNull(),
    meetingAt: timestamp('meeting_at', { withTimezone: true }).notNull(),
    checkInDeadline: timestamp('check_in_deadline', { withTimezone: true }).notNull(),
    emergencyContactName: varchar('emergency_contact_name', { length: 128 }).notNull(),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 32 }).notNull(),
    status: varchar('status', { length: 16 })
      .notNull()
      .default('SCHEDULED')
      .$type<DateCheckinStatus>(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    sosTriggeredAt: timestamp('sos_triggered_at', { withTimezone: true }),
    sosLatitude: doublePrecision('sos_latitude'),
    sosLongitude: doublePrecision('sos_longitude'),
    sosNote: text('sos_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_date_checkins_user').on(table.userId),
    index('idx_date_checkins_match').on(table.matchId),
    index('idx_date_checkins_status').on(table.status),
    index('idx_date_checkins_deadline').on(table.checkInDeadline),
  ]
);

export type DateCheckinRow = typeof dateCheckins.$inferSelect;
export type NewDateCheckinRow = typeof dateCheckins.$inferInsert;
