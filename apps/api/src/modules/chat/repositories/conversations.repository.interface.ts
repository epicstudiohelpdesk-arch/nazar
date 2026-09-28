import type { ConversationStatus } from '@platform/api-contracts';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type {
  ConversationRow,
  ConversationReadStateRow,
} from '../../../infrastructure/database/drizzle/schema/conversations.js';
import type { MatchRow } from '../../../infrastructure/database/drizzle/schema/matches.js';

export const CONVERSATIONS_REPOSITORY_TOKEN = Symbol('IConversationsRepository');

export interface ConversationWithMatchRow {
  readonly conversation: ConversationRow;
  readonly match: MatchRow;
  readonly otherUserId: string;
  readonly lastReadMessageId: string | null;
  readonly lastReadAt: Date | null;
}

export interface IConversationsRepository {
  createConversation(matchId: string, tx?: DrizzleDatabase): Promise<ConversationRow>;
  findConversationById(conversationId: string, tx?: DrizzleDatabase): Promise<ConversationRow | null>;
  findConversationByMatchId(matchId: string, tx?: DrizzleDatabase): Promise<ConversationRow | null>;
  findOrCreateConversationForMatchTx(matchId: string, tx: DrizzleDatabase): Promise<ConversationRow>;
  findConversationsForUser(
    userId: string,
    options: {
      limit: number;
      cursor?: { updatedAt: Date; id: string };
    },
    tx?: DrizzleDatabase
  ): Promise<readonly ConversationWithMatchRow[]>;
  updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    tx?: DrizzleDatabase
  ): Promise<ConversationRow | null>;
  updateLastMessage(
    conversationId: string,
    messageId: string,
    messageAt: Date,
    tx?: DrizzleDatabase
  ): Promise<void>;
  getReadState(
    conversationId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow | null>;
  upsertReadState(
    conversationId: string,
    userId: string,
    lastReadMessageId: string,
    lastReadAt: Date,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow>;
  upsertDeliveredState(
    conversationId: string,
    userId: string,
    lastDeliveredMessageId: string,
    lastDeliveredAt: Date,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow>;
  getUnreadCount(
    conversationId: string,
    userId: string,
    lastReadAt?: Date | null,
    tx?: DrizzleDatabase
  ): Promise<number>;
}
