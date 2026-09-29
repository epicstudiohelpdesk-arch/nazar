import { generateUuidV7 } from '@platform/domain';
import type {
  DeliveryState,
  MessageItemDto,
  MessageType,
  RealtimeEvent,
} from '@platform/api-contracts';
import type { MessageRow } from '../../../infrastructure/database/drizzle/schema/messages.js';

export interface MessageCursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

export interface ConversationCursorPayload {
  readonly updatedAt: string;
  readonly id: string;
}

export function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor<T>(cursor: string): T | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Creates a standard versioned realtime event envelope.
 */
export function createRealtimeEvent<T>(
  event: string,
  payload: T,
  conversationId?: string
): RealtimeEvent<T> {
  return {
    event,
    version: 1,
    eventId: generateUuidV7(),
    conversationId,
    occurredAt: new Date().toISOString(),
    payload,
  };
}

/**
 * Derives the delivery state of a message given the recipient's read/delivery state.
 */
export function deriveDeliveryState(
  message: MessageRow,
  currentUserId: string,
  partnerLastReadAt?: Date | null,
  partnerLastDeliveredAt?: Date | null
): DeliveryState {
  // If the message was sent by the other user, current user already has it
  if (message.senderUserId !== currentUserId) {
    return 'READ';
  }

  const messageTime = message.createdAt.getTime();

  if (partnerLastReadAt && partnerLastReadAt.getTime() >= messageTime) {
    return 'READ';
  }

  if (partnerLastDeliveredAt && partnerLastDeliveredAt.getTime() >= messageTime) {
    return 'DELIVERED';
  }

  return 'SENT';
}

export function formatMessageItemDto(
  message: MessageRow,
  deliveryState: DeliveryState
): MessageItemDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    clientMessageId: message.clientMessageId,
    messageType: message.messageType as MessageType,
    body: message.body,
    metadata: (message.metadata as Record<string, unknown>) || null,
    deliveryState,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() || null,
    deletedAt: message.deletedAt?.toISOString() || null,
  };
}
