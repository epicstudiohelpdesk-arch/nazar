import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { communities } from './communities.js';

/**
 * Events Table (Gate 12)
 * In-person and online events with capacity limits, waitlist management, and location privacy.
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description').notNull(),
    coverMediaId: uuid('cover_media_id'),
    type: varchar('type', { length: 32 }).notNull().default('PHYSICAL'), // 'ONLINE' | 'PHYSICAL'
    status: varchar('status', { length: 32 }).notNull().default('PUBLISHED'), // 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | 'ARCHIVED'
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    locationName: varchar('location_name', { length: 255 }).notNull(),
    locationAddress: text('location_address'),
    locationUrl: varchar('location_url', { length: 500 }),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    capacity: integer('capacity'), // null indicates unlimited capacity
    attendeeCount: integer('attendee_count').notNull().default(0),
    waitlistCount: integer('waitlist_count').notNull().default(0),
    isWaitlistEnabled: boolean('is_waitlist_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_events_organizer').on(table.organizerId),
    index('idx_events_community').on(table.communityId),
    index('idx_events_status').on(table.status),
    index('idx_events_start_at').on(table.startAt),
    check('chk_events_type', sql`${table.type} IN ('ONLINE', 'PHYSICAL')`),
    check(
      'chk_events_status',
      sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'ARCHIVED')`
    ),
  ]
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;

/**
 * Event RSVPs Table (Gate 12)
 * Attendees, interested users, and FIFO waitlist members for an event.
 */
export const eventRsvps = pgTable(
  'event_rsvps',
  {
    id: uuid('id').primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull().default('GOING'), // 'GOING' | 'INTERESTED' | 'CANCELLED' | 'WAITLISTED'
    promotedFromWaitlistAt: timestamp('promoted_from_waitlist_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_event_rsvps_unique').on(table.eventId, table.userId),
    index('idx_event_rsvps_event_status').on(table.eventId, table.status),
    index('idx_event_rsvps_user').on(table.userId),
    index('idx_event_rsvps_created_at').on(table.createdAt),
    check(
      'chk_event_rsvps_status',
      sql`${table.status} IN ('GOING', 'INTERESTED', 'CANCELLED', 'WAITLISTED')`
    ),
  ]
);

export type EventRsvpRow = typeof eventRsvps.$inferSelect;
export type NewEventRsvpRow = typeof eventRsvps.$inferInsert;
