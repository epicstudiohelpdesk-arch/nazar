import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type {
  MessageRow,
  NewMessageRow,
} from '../../../infrastructure/database/drizzle/schema/messages.js';

export const MESSAGES_REPOSITORY_TOKEN = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  createMessage(
    row: NewMessageRow,
    tx?: DrizzleDatabase
  ): Promise<{ message: MessageRow; wasCreated: boolean }>;
  findMessageById(messageId: string, tx?: DrizzleDatabase): Promise<MessageRow | null>;
  findMessageByClientMessageId(
    conversationId: string,
    senderUserId: string,
    clientMessageId: string,
    tx?: DrizzleDatabase
  ): Promise<MessageRow | null>;
  findMessagesByConversation(
    conversationId: string,
    options: {
      limit: number;
      cursor?: { createdAt: Date; id: string };
    },
    tx?: DrizzleDatabase
  ): Promise<readonly MessageRow[]>;
  findMessagesSince(
    conversationId: string,
    sinceCreatedAt: Date,
    sinceId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly MessageRow[]>;
}
