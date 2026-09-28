import { pgTable, uuid, varchar, timestamp, uniqueIndex, index, check, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { matches } from './matches.js';

/**
 * Conversations Table (Gate 08)
 * 1-to-1 conversation mapped strictly to an active mutual match.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'CLOSED'
    lastMessageId: uuid('last_message_id'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_conversations_match_id').on(table.matchId),
    index('idx_conversations_updated_at').on(table.updatedAt),
    index('idx_conversations_status').on(table.status),
    check('chk_conversations_status', sql`${table.status} IN ('ACTIVE', 'CLOSED')`),
  ]
);

export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;

/**
 * Conversation Read States Table (Gate 08)
 * Stores monotonic read cursor and delivery cursor per participant in a conversation.
 */
export const conversationReadStates = pgTable(
  'conversation_read_states',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadMessageId: uuid('last_read_message_id'),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    lastDeliveredMessageId: uuid('last_delivered_message_id'),
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId], name: 'pk_conversation_read_states' }),
    index('idx_conv_read_states_user').on(table.userId),
  ]
);

export type ConversationReadStateRow = typeof conversationReadStates.$inferSelect;
export type NewConversationReadStateRow = typeof conversationReadStates.$inferInsert;
