import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Audit Logs Table
 * Append-only security and operational audit trail.
 * Security Invariant: Passwords, tokens, OTPs, and secrets must NEVER be persisted in metadata.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 128 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_actor_created').on(table.actorUserId, table.createdAt),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
  ]
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;
