import type { PublicMediaItem } from '../profile/profile.contract.js';

export type ConversationStatus = 'ACTIVE' | 'CLOSED';

export type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';

export type DeliveryState = 'SENT' | 'DELIVERED' | 'READ';

export interface ConversationParticipantDto {
  readonly userId: string;
  readonly displayName: string;
  readonly age: number;
  readonly city?: string | null;
  readonly primaryMedia?: PublicMediaItem | null;
}

export interface MessagePreviewDto {
  readonly id: string;
  readonly senderUserId: string;
  readonly preview: string;
  readonly sentAt: string;
  readonly messageType: MessageType;
}

export interface ConversationItemDto {
  readonly id: string;
  readonly matchId: string;
  readonly status: ConversationStatus;
  readonly otherUser: ConversationParticipantDto;
  readonly lastMessage?: MessagePreviewDto | null;
  readonly unreadCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConversationListResponseDto {
  readonly items: readonly ConversationItemDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface ConversationDetailDto {
  readonly id: string;
  readonly matchId: string;
  readonly status: ConversationStatus;
  readonly otherUser: ConversationParticipantDto;
  readonly lastReadMessageId?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MessageItemDto {
  readonly id: string;
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly clientMessageId: string;
  readonly messageType: MessageType;
  readonly body: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly deliveryState: DeliveryState;
  readonly createdAt: string;
  readonly editedAt?: string | null;
  readonly deletedAt?: string | null;
}

export interface SendMessageRequestDto {
  readonly clientMessageId: string;
  readonly body: string;
  readonly messageType?: MessageType;
  readonly metadata?: Record<string, unknown>;
}

export interface SendMessageResponseDto {
  readonly message: MessageItemDto;
}

export interface MessageListResponseDto {
  readonly items: readonly MessageItemDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface MarkReadRequestDto {
  readonly messageId: string;
}

export interface MarkReadResponseDto {
  readonly success: boolean;
  readonly conversationId: string;
  readonly lastReadMessageId: string;
  readonly lastReadAt: string;
}

export interface SyncMessagesResponseDto {
  readonly messages: readonly MessageItemDto[];
  readonly lastReadMessageId?: string | null;
  readonly hasMore: boolean;
}

export interface RealtimeEvent<T = unknown> {
  readonly event: string;
  readonly version: number;
  readonly eventId: string;
  readonly conversationId?: string;
  readonly occurredAt: string;
  readonly payload: T;
}

export interface TypingEventPayload {
  readonly conversationId: string;
  readonly userId: string;
  readonly isTyping: boolean;
}

export interface PresenceEventPayload {
  readonly userId: string;
  readonly isOnline: boolean;
}
