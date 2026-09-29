import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { moderationCases } from './moderation-cases.js';

/**
 * Reports Table
 * First-class user and system reports targeting users, profiles, messages, conversations, and media.
 * Supports deterministic deduplication, server-assigned priority, and moderation case linkage.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey(),
    reporterUserId: uuid('reporter_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(), // 'USER' | 'PROFILE' | 'MESSAGE' | 'CONVERSATION' | 'MEDIA'
    targetId: uuid('target_id').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata'),
    status: varchar('status', { length: 32 }).notNull().default('OPEN'), // 'OPEN' | 'UNDER_REVIEW' | 'ACTIONED' | 'DISMISSED' | 'DUPLICATE' | 'CLOSED'
    priority: varchar('priority', { length: 16 }).notNull().default('NORMAL'), // 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    moderationCaseId: uuid('moderation_case_id').references(() => moderationCases.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_reports_reporter_created').on(table.reporterUserId, table.createdAt),
    index('idx_reports_target').on(table.targetType, table.targetId),
    index('idx_reports_target_user').on(table.targetUserId),
    index('idx_reports_status_priority').on(table.status, table.priority),
    uniqueIndex('idx_reports_open_dedup')
      .on(table.reporterUserId, table.targetType, table.targetId, table.reasonCode)
      .where(sql`status = 'OPEN'`),
  ]
);

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;
