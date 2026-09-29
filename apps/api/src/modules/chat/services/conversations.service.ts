import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  ErrorCode,
  type ConversationListResponseDto,
  type ConversationDetailDto,
  type ConversationItemDto,
  type MessagePreviewDto,
  type ConversationStatus,
  type PublicMediaItem,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import type { GetConversationsQueryInput } from '@platform/validation';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { profileMedia } from '../../../infrastructure/database/drizzle/schema/profile-media.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { STORAGE_SERVICE_TOKEN } from '../../../infrastructure/storage/storage.interface.js';
import {
  CONVERSATIONS_REPOSITORY_TOKEN,
  type IConversationsRepository,
} from '../repositories/conversations.repository.interface.js';
import {
  MESSAGES_REPOSITORY_TOKEN,
  type IMessagesRepository,
} from '../repositories/messages.repository.interface.js';
import {
  MATCHES_REPOSITORY_TOKEN,
  type IMatchesRepository,
} from '../../matches/repositories/matches.repository.interface.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import { SafetyEnforcementService } from '../../safety/services/safety-enforcement.service.js';
import {
  encodeCursor,
  decodeCursor,
  type ConversationCursorPayload,
} from '../domain/chat.utils.js';
import type { ConversationRow } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import type { MatchRow } from '../../../infrastructure/database/drizzle/schema/matches.js';

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(CONVERSATIONS_REPOSITORY_TOKEN)
    private readonly conversationsRepo: IConversationsRepository,
    @Inject(MESSAGES_REPOSITORY_TOKEN)
    private readonly messagesRepo: IMessagesRepository,
    @Inject(MATCHES_REPOSITORY_TOKEN)
    private readonly matchesRepo: IMatchesRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: S3StorageService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(SafetyEnforcementService)
    private readonly safetyEnforcement: SafetyEnforcementService
  ) {}

  private async getPrimaryMediaForUser(userId: string): Promise<PublicMediaItem | null> {
    const mediaRows = await this.databaseService.client
      .select()
      .from(profileMedia)
      .where(
        and(
          eq(profileMedia.userId, userId),
          eq(profileMedia.isPrimary, true),
          eq(profileMedia.status, 'READY')
        )
      )
      .limit(1);

    if (mediaRows && mediaRows.length > 0 && mediaRows[0]) {
      const m = mediaRows[0];
      return {
        id: m.id,
        url: this.storageService.getPublicUrl(m.objectKey),
        position: m.position,
        isPrimary: m.isPrimary,
      };
    }
    return null;
  }

  async listConversations(
    userId: string,
    query: GetConversationsQueryInput
  ): Promise<ConversationListResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { updatedAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor<ConversationCursorPayload>(query.cursor);
      if (decoded && decoded.updatedAt && decoded.id) {
        parsedCursor = {
          updatedAt: new Date(decoded.updatedAt),
          id: decoded.id,
        };
      } else {
        throw new HttpException(
          { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation cursor' },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const rows = await this.conversationsRepo.findConversationsForUser(userId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: ConversationItemDto[] = [];
    for (const r of pageRows) {
      const isBlocked = await this.safetyEnforcement.isUserBlockedBidirectional(userId, r.otherUserId);
      if (isBlocked) {
        continue;
      }

      const otherProfile = await this.profileRepo.findByUserId(r.otherUserId);
      const primaryMediaDto = await this.getPrimaryMediaForUser(r.otherUserId);

      let lastMessagePreview: MessagePreviewDto | null = null;
      if (r.conversation.lastMessageId) {
        const msg = await this.messagesRepo.findMessageById(r.conversation.lastMessageId);
        if (msg) {
          lastMessagePreview = {
            id: msg.id,
            senderUserId: msg.senderUserId,
            preview: msg.body.length > 60 ? `${msg.body.substring(0, 60)}...` : msg.body,
            sentAt: msg.createdAt.toISOString(),
            messageType: msg.messageType as 'TEXT' | 'IMAGE' | 'SYSTEM',
          };
        }
      }

      const unreadCount = await this.conversationsRepo.getUnreadCount(
        r.conversation.id,
        userId,
        r.lastReadAt
      );

      items.push({
        id: r.conversation.id,
        matchId: r.match.id,
        status: r.conversation.status as ConversationStatus,
        otherUser: {
          userId: r.otherUserId,
          displayName: otherProfile?.displayName || 'User',
          age: otherProfile?.dateOfBirth ? calculateAge(otherProfile.dateOfBirth) : 25,
          city: otherProfile?.city || null,
          primaryMedia: primaryMediaDto,
        },
        lastMessage: lastMessagePreview,
        unreadCount,
        createdAt: r.conversation.createdAt.toISOString(),
        updatedAt: r.conversation.updatedAt.toISOString(),
      });
    }

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          updatedAt: last.conversation.updatedAt.toISOString(),
          id: last.conversation.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getConversationDetail(
    userId: string,
    conversationId: string
  ): Promise<ConversationDetailDto> {
    const { conversation, match, otherUserId } = await this.assertConversationAccess(
      userId,
      conversationId
    );

    const otherProfile = await this.profileRepo.findByUserId(otherUserId);
    const primaryMediaDto = await this.getPrimaryMediaForUser(otherUserId);
    const readState = await this.conversationsRepo.getReadState(conversationId, userId);

    return {
      id: conversation.id,
      matchId: match.id,
      status: conversation.status as ConversationStatus,
      otherUser: {
        userId: otherUserId,
        displayName: otherProfile?.displayName || 'User',
        age: otherProfile?.dateOfBirth ? calculateAge(otherProfile.dateOfBirth) : 25,
        city: otherProfile?.city || null,
        primaryMedia: primaryMediaDto,
      },
      lastReadMessageId: readState?.lastReadMessageId || null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async assertConversationAccess(
    userId: string,
    conversationId: string
  ): Promise<{
    conversation: ConversationRow;
    match: MatchRow;
    otherUserId: string;
  }> {
    const conversation = await this.conversationsRepo.findConversationById(conversationId);
    if (!conversation) {
      throw new HttpException(
        { code: ErrorCode.CONVERSATION_NOT_FOUND, message: 'Conversation not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const match = await this.matchesRepo.findMatchById(conversation.matchId);
    if (!match) {
      throw new HttpException(
        { code: ErrorCode.CONVERSATION_NOT_FOUND, message: 'Associated match not found' },
        HttpStatus.NOT_FOUND
      );
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      throw new HttpException(
        { code: ErrorCode.CONVERSATION_ACCESS_DENIED, message: 'You are not a participant in this conversation' },
        HttpStatus.FORBIDDEN
      );
    }

    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;

    const isBlocked = await this.safetyEnforcement.isUserBlockedBidirectional(userId, otherUserId);
    if (isBlocked) {
      throw new HttpException(
        { code: ErrorCode.USER_BLOCKED, message: 'Conversation is inaccessible due to safety settings' },
        HttpStatus.FORBIDDEN
      );
    }

    return { conversation, match, otherUserId };
  }

  async getOrCreateConversationForMatch(
    matchId: string,
    tx?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ConversationRow> {
    if (tx) {
      return this.conversationsRepo.findOrCreateConversationForMatchTx(matchId, tx);
    }
    return this.databaseService.withTransaction(async (innerTx) => {
      return this.conversationsRepo.findOrCreateConversationForMatchTx(matchId, innerTx);
    });
  }
}
