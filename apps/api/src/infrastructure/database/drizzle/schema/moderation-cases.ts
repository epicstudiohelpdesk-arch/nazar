import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Moderation Cases Table
 * Authoritative case management abstraction aggregating user reports, automated signals,
 * and administrative reviews against subject accounts.
 */
export const moderationCases = pgTable(
  'moderation_cases',
  {
    id: uuid('id').primaryKey(),
    subjectUserId: uuid('subject_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull(), // 'REPORT' | 'AUTOMATED_SIGNAL' | 'SYSTEM'
    sourceId: uuid('source_id'),
    caseType: varchar('case_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('OPEN'), // 'OPEN' | 'TRIAGED' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'RESOLVED' | 'DISMISSED'
    priority: varchar('priority', { length: 16 }).notNull().default('NORMAL'), // 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    assignedTo: uuid('assigned_to'),
    resolutionDecision: varchar('resolution_decision', { length: 64 }),
    openedAt: timestamp('opened_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_mod_cases_subject').on(table.subjectUserId),
    index('idx_mod_cases_status_priority').on(table.status, table.priority),
    index('idx_mod_cases_opened').on(table.openedAt),
  ]
);

export type ModerationCaseRow = typeof moderationCases.$inferSelect;
export type NewModerationCaseRow = typeof moderationCases.$inferInsert;
