import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { moderationCases } from './moderation-cases.js';

/**
 * Moderation Case Events Table
 * Append-only immutable history recording all lifecycle events, triage transitions,
 * evidence attachments, and decision applications on a moderation case.
 */
export const moderationCaseEvents = pgTable(
  'moderation_case_events',
  {
    id: uuid('id').primaryKey(),
    caseId: uuid('case_id')
      .references(() => moderationCases.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    actorUserId: uuid('actor_user_id'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_case_events_case_created').on(table.caseId, table.createdAt),
  ]
);

export type ModerationCaseEventRow = typeof moderationCaseEvents.$inferSelect;
export type NewModerationCaseEventRow = typeof moderationCaseEvents.$inferInsert;
