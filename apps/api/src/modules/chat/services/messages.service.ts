import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  type SendMessageResponseDto,
  type MessageListResponseDto,
  type MarkReadResponseDto,
  type SyncMessagesResponseDto,
} from '@platform/api-contracts';
import type {
  SendMessageInput,
  GetMessagesQueryInput,
  SyncMessagesQueryInput,
} from '@platform/validation';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import {
  MESSAGES_REPOSITORY_TOKEN,
  type IMessagesRepository,
} from '../repositories/messages.repository.interface.js';
import {
  CONVERSATIONS_REPOSITORY_TOKEN,
  type IConversationsRepository,
} from '../repositories/conversations.repository.interface.js';
import { ConversationsService } from './conversations.service.js';
import {
  encodeCursor,
  decodeCursor,
  deriveDeliveryState,
  formatMessageItemDto,
  type MessageCursorPayload,
} from '../domain/chat.utils.js';
import type { MessageRow } from '../../../infrastructure/database/drizzle/schema/messages.js';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MESSAGES_REPOSITORY_TOKEN)
    private readonly messagesRepo: IMessagesRepository,
    @Inject(CONVERSATIONS_REPOSITORY_TOKEN)
    private readonly conversationsRepo: IConversationsRepository,
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async sendMessage(
    senderUserId: string,
    conversationId: string,
    input: SendMessageInput
  ): Promise<SendMessageResponseDto> {
    const { conversation, match, otherUserId } =
      await this.conversationsService.assertConversationAccess(senderUserId, conversationId);

    // Enforce match/conversation active state (Requirements 5, 45)
    if (conversation.status !== 'ACTIVE' || match.status !== 'ACTIVE') {
      throw new HttpException(
        {
          code: ErrorCode.CONVERSATION_CLOSED,
          message: 'Cannot send messages to a closed or unmatched conversation',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const trimmedBody = input.body.trim();
    if (!trimmedBody) {
      throw new HttpException(
        { code: ErrorCode.MESSAGE_EMPTY, message: 'Message body cannot be empty' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (trimmedBody.length > 2000) {
      throw new HttpException(
        { code: ErrorCode.MESSAGE_TOO_LONG, message: 'Message body exceeds 2000 characters' },
        HttpStatus.BAD_REQUEST
      );
    }

    const messageId = generateUuidV7();
    const now = new Date();

    return this.databaseService.withTransaction(async (tx) => {
      const { message, wasCreated } = await this.messagesRepo.createMessage(
        {
          id: messageId,
          conversationId,
          senderUserId,
          clientMessageId: input.clientMessageId,
          messageType: input.messageType || 'TEXT',
          body: trimmedBody,
          metadata: input.metadata || null,
          createdAt: now,
        },
        tx
      );

      if (wasCreated) {
        // Update conversation last message pointer
        await this.conversationsRepo.updateLastMessage(conversationId, message.id, message.createdAt, tx);

        // Emit durable outbox event (Requirement 30)
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'message.created',
          aggregateType: 'MESSAGE',
          aggregateId: message.id,
          payload: {
            messageId: message.id,
            conversationId: message.conversationId,
            senderUserId,
            recipientUserId: otherUserId,
            clientMessageId: message.clientMessageId,
            messageType: message.messageType,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
          },
          status: 'PENDING',
        });
      }

      return {
        message: formatMessageItemDto(message, 'SENT'),
      };
    });
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: GetMessagesQueryInput
  ): Promise<MessageListResponseDto> {
    const { otherUserId } = await this.conversationsService.assertConversationAccess(
      userId,
      conversationId
    );

    const limit = Math.min(Math.max(query.limit || 50, 1), 100);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor<MessageCursorPayload>(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      } else {
        throw new HttpException(
          { code: ErrorCode.INVALID_MESSAGE_CURSOR, message: 'Invalid message cursor provided' },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const rows = await this.messagesRepo.findMessagesByConversation(conversationId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Fetch partner's read/delivery state to evaluate outgoing message delivery states
    const partnerReadState = await this.conversationsRepo.getReadState(conversationId, otherUserId);

    const items = pageRows.map((msg) => {
      const state = deriveDeliveryState(
        msg,
        userId,
        partnerReadState?.lastReadAt,
        partnerReadState?.lastDeliveredAt
      );
      return formatMessageItemDto(msg, state);
    });

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async markAsRead(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<MarkReadResponseDto> {
    const { otherUserId } = await this.conversationsService.assertConversationAccess(
      userId,
      conversationId
    );

    const targetMessage = await this.messagesRepo.findMessageById(messageId);
    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      throw new HttpException(
        { code: ErrorCode.MESSAGE_NOT_FOUND, message: 'Message does not exist in this conversation' },
        HttpStatus.NOT_FOUND
      );
    }

    // Monotonicity check: do not regress read cursor (Requirement 25)
    const currentReadState = await this.conversationsRepo.getReadState(conversationId, userId);
    if (currentReadState?.lastReadAt && currentReadState.lastReadAt.getTime() > targetMessage.createdAt.getTime()) {
      return {
        success: true,
        conversationId,
        lastReadMessageId: currentReadState.lastReadMessageId || targetMessage.id,
        lastReadAt: currentReadState.lastReadAt.toISOString(),
      };
    }

    const readAt = new Date();

    return this.databaseService.withTransaction(async (tx) => {
      await this.conversationsRepo.upsertReadState(
        conversationId,
        userId,
        targetMessage.id,
        readAt,
        tx
      );

      // Emit outbox event (Requirement 30)
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'message.read',
        aggregateType: 'CONVERSATION',
        aggregateId: conversationId,
        payload: {
          conversationId,
          readerUserId: userId,
          otherUserId,
          messageId: targetMessage.id,
          readAt: readAt.toISOString(),
        },
        status: 'PENDING',
      });

      return {
        success: true,
        conversationId,
        lastReadMessageId: targetMessage.id,
        lastReadAt: readAt.toISOString(),
      };
    });
  }

  async markAsDelivered(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<void> {
    const { otherUserId } = await this.conversationsService.assertConversationAccess(
      userId,
      conversationId
    );

    const targetMessage = await this.messagesRepo.findMessageById(messageId);
    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      return;
    }

    const deliveredAt = new Date();

    await this.databaseService.withTransaction(async (tx) => {
      await this.conversationsRepo.upsertDeliveredState(
        conversationId,
        userId,
        targetMessage.id,
        deliveredAt,
        tx
      );

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'message.delivered',
        aggregateType: 'CONVERSATION',
        aggregateId: conversationId,
        payload: {
          conversationId,
          recipientUserId: userId,
          senderUserId: otherUserId,
          messageId: targetMessage.id,
          deliveredAt: deliveredAt.toISOString(),
        },
        status: 'PENDING',
      });
    });
  }

  async syncMessages(
    userId: string,
    conversationId: string,
    query: SyncMessagesQueryInput
  ): Promise<SyncMessagesResponseDto> {
    const { otherUserId } = await this.conversationsService.assertConversationAccess(
      userId,
      conversationId
    );

    const limit = Math.min(Math.max(query.limit || 50, 1), 100);

    let messagesList: readonly MessageRow[] = [];

    if (query.sinceMessageId) {
      const sinceMsg = await this.messagesRepo.findMessageById(query.sinceMessageId);
      if (sinceMsg && sinceMsg.conversationId === conversationId) {
        messagesList = await this.messagesRepo.findMessagesSince(
          conversationId,
          sinceMsg.createdAt,
          sinceMsg.id,
          limit + 1
        );
      }
    }

    if (messagesList.length === 0 && !query.sinceMessageId) {
      // Return initial latest messages
      const newestDesc = await this.messagesRepo.findMessagesByConversation(conversationId, {
        limit: limit + 1,
      });
      // Reverse to chronological
      messagesList = [...newestDesc].reverse();
    }

    const hasMore = messagesList.length > limit;
    const pageRows = hasMore ? messagesList.slice(0, limit) : messagesList;

    const partnerReadState = await this.conversationsRepo.getReadState(conversationId, otherUserId);
    const myReadState = await this.conversationsRepo.getReadState(conversationId, userId);

    // If new incoming messages exist, update my delivered state to the latest incoming message
    const lastIncoming = [...pageRows].reverse().find((m) => m.senderUserId !== userId);
    if (lastIncoming) {
      await this.conversationsRepo.upsertDeliveredState(
        conversationId,
        userId,
        lastIncoming.id,
        new Date()
      );
    }

    const items = pageRows.map((msg) => {
      const state = deriveDeliveryState(
        msg,
        userId,
        partnerReadState?.lastReadAt,
        partnerReadState?.lastDeliveredAt
      );
      return formatMessageItemDto(msg, state);
    });

    return {
      messages: items,
      lastReadMessageId: myReadState?.lastReadMessageId || null,
      hasMore,
    };
  }
}
