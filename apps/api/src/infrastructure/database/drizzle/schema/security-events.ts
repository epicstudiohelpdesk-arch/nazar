import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Security Events Table
 * Durable security telemetry (anomalous logins, rate limit breaches, security actions).
 */
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id'),
    deviceId: uuid('device_id'),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('INFO'), // 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_security_events_type_created').on(table.eventType, table.createdAt),
    index('idx_security_events_user').on(table.userId),
  ]
);

export type SecurityEventRow = typeof securityEvents.$inferSelect;
export type NewSecurityEventRow = typeof securityEvents.$inferInsert;
