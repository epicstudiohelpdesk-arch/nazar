import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { CallType, CallStatus } from '@platform/api-contracts';
import { users } from './users.js';
import { conversations } from './conversations.js';

export const callSessions = pgTable(
  'call_sessions',
  {
    id: uuid('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    callerUserId: uuid('caller_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calleeUserId: uuid('callee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    callType: varchar('call_type', { length: 16 }).notNull().$type<CallType>(),
    status: varchar('status', { length: 16 }).notNull().default('RINGING').$type<CallStatus>(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_call_sessions_conversation').on(table.conversationId),
    index('idx_call_sessions_caller').on(table.callerUserId),
    index('idx_call_sessions_callee').on(table.calleeUserId),
    index('idx_call_sessions_status').on(table.status),
  ]
);

export type CallSessionRow = typeof callSessions.$inferSelect;
export type NewCallSessionRow = typeof callSessions.$inferInsert;
