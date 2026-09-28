import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChatApi } from '../src/chat/chat-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  ConversationListResponseDto,
  ConversationDetailDto,
  MessageListResponseDto,
  SendMessageResponseDto,
  MarkReadResponseDto,
  SyncMessagesResponseDto,
} from '@platform/api-contracts';

describe('Mobile Chat Layer: API Client & Optimistic Reconciliation', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConversationsResponse: ConversationListResponseDto = {
    items: [
      {
        id: 'conv-1',
        matchId: 'match-1',
        status: 'ACTIVE',
        otherUser: {
          userId: 'user-b',
          displayName: 'Priya',
          age: 26,
          city: 'Bangalore',
          primaryMedia: {
            id: 'med-1',
            url: 'https://cdn.example.com/priya.jpg',
            position: 0,
            isPrimary: true,
          },
        },
        lastMessage: {
          id: 'msg-1',
          senderUserId: 'user-b',
          preview: 'Hey, nice to match with you!',
          sentAt: '2026-09-28T14:00:00.000Z',
          messageType: 'TEXT',
        },
        unreadCount: 1,
        createdAt: '2026-09-28T13:00:00.000Z',
        updatedAt: '2026-09-28T14:00:00.000Z',
      },
    ],
    nextCursor: null,
    hasMore: false,
  };

  const mockDetailResponse: ConversationDetailDto = {
    id: 'conv-1',
    matchId: 'match-1',
    status: 'ACTIVE',
    otherUser: {
      userId: 'user-b',
      displayName: 'Priya',
      age: 26,
      city: 'Bangalore',
      primaryMedia: {
        id: 'med-1',
        url: 'https://cdn.example.com/priya.jpg',
        position: 0,
        isPrimary: true,
      },
    },
    lastReadMessageId: 'msg-1',
    createdAt: '2026-09-28T13:00:00.000Z',
    updatedAt: '2026-09-28T14:00:00.000Z',
  };

  const mockMessagesResponse: MessageListResponseDto = {
    items: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderUserId: 'user-b',
        clientMessageId: 'client-1',
        messageType: 'TEXT',
        body: 'Hey, nice to match with you!',
        metadata: null,
        deliveryState: 'READ',
        createdAt: '2026-09-28T14:00:00.000Z',
        editedAt: null,
        deletedAt: null,
      },
    ],
    nextCursor: null,
    hasMore: false,
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('mobile_chat_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  describe('API Client Methods', () => {
    it('retrieves conversations list with query parameters', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockConversationsResponse,
            requestId: 'req-convs-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.getConversations({ limit: 10 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/conversations?limit=10');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].otherUser.displayName).toBe('Priya');
      expect(result.items[0].unreadCount).toBe(1);
    });

    it('retrieves conversation detail by ID', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockDetailResponse,
            requestId: 'req-conv-detail-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.getConversationDetail('conv-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/conversations/conv-1');
      expect(result.id).toBe('conv-1');
      expect(result.otherUser.displayName).toBe('Priya');
    });

    it('retrieves messages history for a conversation', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockMessagesResponse,
            requestId: 'req-msgs-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.getMessages('conv-1', { limit: 20 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/conversations/conv-1/messages?limit=20');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].body).toBe('Hey, nice to match with you!');
      expect(result.items[0].deliveryState).toBe('READ');
    });

    it('sends a message successfully and returns persisted message dto', async () => {
      const mockSendResponse: SendMessageResponseDto = {
        message: {
          id: 'msg-2',
          conversationId: 'conv-1',
          senderUserId: 'user-a',
          clientMessageId: 'client-msg-2',
          messageType: 'TEXT',
          body: 'Hello back!',
          metadata: null,
          deliveryState: 'SENT',
          createdAt: '2026-09-28T14:05:00.000Z',
          editedAt: null,
          deletedAt: null,
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockSendResponse,
            requestId: 'req-send-001',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.sendMessage('conv-1', {
        clientMessageId: 'client-msg-2',
        body: 'Hello back!',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/conversations/conv-1/messages');
      expect(options.method).toBe('POST');
      expect(result.message.id).toBe('msg-2');
      expect(result.message.deliveryState).toBe('SENT');
    });

    it('marks conversation messages as read', async () => {
      const mockReadResponse: MarkReadResponseDto = {
        success: true,
        conversationId: 'conv-1',
        lastReadMessageId: 'msg-1',
        lastReadAt: '2026-09-28T14:06:00.000Z',
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockReadResponse,
            requestId: 'req-read-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.markRead('conv-1', 'msg-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/conversations/conv-1/read');
      expect(options.method).toBe('POST');
      expect(result.success).toBe(true);
      expect(result.lastReadMessageId).toBe('msg-1');
    });

    it('synchronizes missed messages since a checkpoint', async () => {
      const mockSyncResponse: SyncMessagesResponseDto = {
        messages: mockMessagesResponse.items,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockSyncResponse,
            requestId: 'req-sync-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createChatApi(authClient);
      const result = await api.syncMessages('conv-1', { sinceMessageId: 'msg-0' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/conversations/conv-1/sync?sinceMessageId=msg-0');
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('Optimistic Message Reconciliation', () => {
    it('simulates optimistic insertion, success confirmation, and failure transition', () => {
      // 1. Initial empty or loaded list
      let optimisticMessages: Array<{
        id: string;
        clientMessageId: string;
        body: string;
        isOptimistic?: boolean;
        sendFailed?: boolean;
        deliveryState: string;
      }> = [];

      // 2. User presses Send: create optimistic item
      const clientMessageId = 'client-uuid-123';
      const optimisticItem = {
        id: clientMessageId,
        clientMessageId,
        body: 'Optimistic message body',
        isOptimistic: true,
        sendFailed: false,
        deliveryState: 'SENT',
      };

      optimisticMessages = [optimisticItem, ...optimisticMessages];
      expect(optimisticMessages).toHaveLength(1);
      expect(optimisticMessages[0].isOptimistic).toBe(true);
      expect(optimisticMessages[0].sendFailed).toBe(false);

      // 3. Reconcile on success: replace optimistic item with confirmed server item
      const serverMessage = {
        id: 'server-uuid-456',
        clientMessageId,
        body: 'Optimistic message body',
        isOptimistic: false,
        sendFailed: false,
        deliveryState: 'SENT',
      };

      const reconciledMessages = optimisticMessages.map((msg) =>
        msg.clientMessageId === serverMessage.clientMessageId ? serverMessage : msg
      );

      expect(reconciledMessages[0].id).toBe('server-uuid-456');
      expect(reconciledMessages[0].isOptimistic).toBe(false);

      // 4. Alternatively, simulate failure transition
      const failedMessages = optimisticMessages.map((msg) =>
        msg.clientMessageId === clientMessageId
          ? { ...msg, sendFailed: true, isOptimistic: false }
          : msg
      );

      expect(failedMessages[0].sendFailed).toBe(true);
    });
  });
});
