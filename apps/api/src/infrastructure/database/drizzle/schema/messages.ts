import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { conversations } from './conversations.js';

/**
 * Messages Table (Gate 08)
 * Durable message entity with server-authoritative timestamps, ordering,
 * and per-sender-conversation clientMessageId uniqueness for idempotency.
 * Supports text, images, and voice note audio messages.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientMessageId: varchar('client_message_id', { length: 64 }).notNull(),
    messageType: varchar('message_type', { length: 32 }).notNull().default('TEXT'),
    body: text('body').notNull(),
    mediaUrl: text('media_url'),
    durationSeconds: integer('duration_seconds'),
    waveformPeaks: jsonb('waveform_peaks'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_messages_conv_sender_client_msg').on(
      table.conversationId,
      table.senderUserId,
      table.clientMessageId
    ),
    index('idx_messages_conv_created_id').on(table.conversationId, table.createdAt, table.id),
    index('idx_messages_sender').on(table.senderUserId),
    check('chk_messages_type', sql`${table.messageType} IN ('TEXT', 'IMAGE', 'AUDIO', 'SYSTEM')`),
  ]
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
