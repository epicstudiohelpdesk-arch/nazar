import { pgTable, uuid, varchar, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * User Interactions Table (Gate 07)
 * Directional user-to-user interactions (LIKE / PASS).
 * Enforces directional uniqueness and forbids self-interaction at the database level.
 */
export const userInteractions = pgTable(
  'user_interactions',
  {
    id: uuid('id').primaryKey(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 16 }).notNull(), // 'LIKE' | 'PASS'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_interactions_actor_target').on(table.actorUserId, table.targetUserId),
    index('idx_user_interactions_actor_type').on(table.actorUserId, table.type),
    index('idx_user_interactions_target_type').on(table.targetUserId, table.type),
    check('chk_user_interactions_no_self', sql`${table.actorUserId} <> ${table.targetUserId}`),
    check('chk_user_interactions_type', sql`${table.type} IN ('LIKE', 'PASS')`),
  ]
);

export type UserInteractionRow = typeof userInteractions.$inferSelect;
export type NewUserInteractionRow = typeof userInteractions.$inferInsert;
