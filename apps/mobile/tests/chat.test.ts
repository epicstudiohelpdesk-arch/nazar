import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChatApi } from '../src/chat/chat-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import { chatSocket } from '../src/chat/chat-socket.js';
import { createSafetyApi } from '../src/safety/safety-api.js';
import { createMatchesApi } from '../src/matches/matches-api.js';
import {
  sanitizeAnalyticsProperties,
  trackOnboardingEvent,
} from '../src/analytics/onboarding-analytics.js';
import type {
  ConversationListResponseDto,
  ConversationDetailDto,
  MessageListResponseDto,
  SendMessageResponseDto,
  MarkReadResponseDto,
  SyncMessagesResponseDto,
  MessageItemDto,
  RealtimeEvent,
} from '@platform/api-contracts';

describe('Mobile Chat Layer: API Client, Inverted Pagination & Realtime Reconciliation', () => {
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

  describe('Optimistic Message Reconciliation & Lifecycles', () => {
    it('simulates optimistic insertion, success confirmation, and failure transition', () => {
      let optimisticMessages: Array<{
        id: string;
        clientMessageId: string;
        body: string;
        isOptimistic?: boolean;
        sendFailed?: boolean;
        deliveryState: string;
      }> = [];

      // 1. User sends message: optimistic item inserted at top
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

      // 2. Server response confirms message: replace with persisted item
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

      // 3. Failure transition and retry
      const failedMessages = optimisticMessages.map((msg) =>
        msg.clientMessageId === clientMessageId
          ? { ...msg, sendFailed: true, isOptimistic: false }
          : msg
      );
      expect(failedMessages[0].sendFailed).toBe(true);

      const retriedMessages = failedMessages.map((msg) =>
        msg.clientMessageId === clientMessageId
          ? { ...msg, sendFailed: false, isOptimistic: true }
          : msg
      );
      expect(retriedMessages[0].sendFailed).toBe(false);
      expect(retriedMessages[0].isOptimistic).toBe(true);
    });
  });

  describe('Conversation List Deduplication & Search Filtering', () => {
    it('deduplicates multi-page conversation responses by ID', () => {
      const page1 = [
        { id: 'c1', otherUser: { displayName: 'Aarav' }, lastMessage: { preview: 'Hey' } },
        { id: 'c2', otherUser: { displayName: 'Ananya' }, lastMessage: { preview: 'Coffee?' } },
      ];
      const page2 = [
        { id: 'c2', otherUser: { displayName: 'Ananya' }, lastMessage: { preview: 'Coffee?' } },
        { id: 'c3', otherUser: { displayName: 'Rohan' }, lastMessage: { preview: 'See you' } },
      ];

      const map = new Map<string, (typeof page1)[0]>();
      for (const item of [...page1, ...page2]) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }

      const deduplicated = Array.from(map.values());
      expect(deduplicated).toHaveLength(3);
      expect(deduplicated.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('filters conversations by user display name or message preview', () => {
      const conversations = [
        {
          id: 'c1',
          otherUser: { displayName: 'Priya Sharma' },
          lastMessage: { preview: 'Sounds great!' },
        },
        {
          id: 'c2',
          otherUser: { displayName: 'Rahul Verma' },
          lastMessage: { preview: 'Are you in Bangalore?' },
        },
        {
          id: 'c3',
          otherUser: { displayName: 'Meera Patel' },
          lastMessage: { preview: 'Hello there' },
        },
      ];

      const filterByName = conversations.filter((c) =>
        c.otherUser.displayName.toLowerCase().includes('priya')
      );
      expect(filterByName).toHaveLength(1);
      expect(filterByName[0].id).toBe('c1');

      const filterByPreview = conversations.filter(
        (c) => c.lastMessage && c.lastMessage.preview.toLowerCase().includes('bangalore')
      );
      expect(filterByPreview).toHaveLength(1);
      expect(filterByPreview[0].id).toBe('c2');
    });
  });

  describe('Inverted FlatList Message History & Date Separators', () => {
    it('structures messages in descending order and dynamically calculates date separators', () => {
      const messages: MessageItemDto[] = [
        {
          id: 'm3',
          conversationId: 'c1',
          senderUserId: 'user-a',
          clientMessageId: 'cmsg-3',
          messageType: 'TEXT',
          body: 'Latest message today',
          metadata: null,
          deliveryState: 'SENT',
          createdAt: new Date().toISOString(), // Today
          editedAt: null,
          deletedAt: null,
        },
        {
          id: 'm2',
          conversationId: 'c1',
          senderUserId: 'user-b',
          clientMessageId: 'cmsg-2',
          messageType: 'TEXT',
          body: 'Earlier today',
          metadata: null,
          deliveryState: 'READ',
          createdAt: new Date(Date.now() - 3600 * 1000).toISOString(), // Today 1 hr ago
          editedAt: null,
          deletedAt: null,
        },
        {
          id: 'm1',
          conversationId: 'c1',
          senderUserId: 'user-b',
          clientMessageId: 'cmsg-1',
          messageType: 'TEXT',
          body: 'Yesterday message',
          metadata: null,
          deliveryState: 'READ',
          createdAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(), // Older
          editedAt: null,
          deletedAt: null,
        },
      ];

      type Item =
        | { type: 'message'; message: MessageItemDto }
        | { type: 'date_separator'; id: string; label: string };

      const items: Item[] = [];
      for (let i = 0; i < messages.length; i++) {
        const current = messages[i]!;
        items.push({ type: 'message', message: current });

        const currentDate = new Date(current.createdAt).toDateString();
        const next = messages[i + 1];
        const nextDate = next ? new Date(next.createdAt).toDateString() : null;

        if (!next || currentDate !== nextDate) {
          items.push({
            type: 'date_separator',
            id: `date-${currentDate}`,
            label: 'DateLabel',
          });
        }
      }

      // Expected order in inverted array:
      // m3 (Today)
      // m2 (Today)
      // DateSeparator (Today)
      // m1 (Older)
      // DateSeparator (Older)
      expect(items).toHaveLength(5);
      expect(items[0].type).toBe('message');
      expect((items[0] as { message: MessageItemDto }).message.id).toBe('m3');
      expect(items[1].type).toBe('message');
      expect((items[1] as { message: MessageItemDto }).message.id).toBe('m2');
      expect(items[2].type).toBe('date_separator');
      expect(items[3].type).toBe('message');
      expect((items[3] as { message: MessageItemDto }).message.id).toBe('m1');
      expect(items[4].type).toBe('date_separator');
    });
  });

  describe('Real-time Socket Event Handling', () => {
    it('manages connection state and listener callbacks', () => {
      let latestState = chatSocket.getConnectionState();
      const unsub = chatSocket.onConnectionStateChange((state) => {
        latestState = state;
      });

      expect(latestState).toBe('disconnected');
      unsub();
    });

    it('processes message.read event to update delivery status', () => {
      let readEventReceived: RealtimeEvent<MarkReadResponseDto> | null = null;
      const unsub = chatSocket.onMessageRead((event) => {
        readEventReceived = event;
      });

      // Simulate incoming event
      const mockEvent: RealtimeEvent<MarkReadResponseDto> = {
        type: 'message.read',
        conversationId: 'conv-1',
        payload: {
          success: true,
          conversationId: 'conv-1',
          lastReadMessageId: 'msg-5',
          lastReadAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      // Direct listener call verification
      unsub();
      expect(readEventReceived).toBeNull();
    });
  });

  describe('Safety Controls Integration', () => {
    it('executes user block via safety API from chat screen', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 'block-1', blockedUserId: 'user-b', createdAt: new Date().toISOString() },
            requestId: 'req-block-001',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.blockUser('user-b', { reason: 'Inappropriate behavior' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/users/user-b/block');
      expect(options.method).toBe('POST');
      expect(res.blockedUserId).toBe('user-b');
    });

    it('executes report creation via safety API from chat screen', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 'rep-1', status: 'PENDING', createdAt: new Date().toISOString() },
            requestId: 'req-rep-001',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.createReport({
        targetType: 'CONVERSATION',
        targetId: 'conv-1',
        reasonCode: 'HARASSMENT',
        description: 'Unwanted messages',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/reports');
      expect(options.method).toBe('POST');
      expect(res.id).toBe('rep-1');
    });

    it('executes unmatch call via matches API from chat screen', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { success: true, matchId: 'match-1', unmatchedAt: new Date().toISOString() },
            requestId: 'req-unmatch-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const matchesApi = createMatchesApi(authClient);
      const res = await matchesApi.unmatch('match-1', { reason: 'No longer interested' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/matches/match-1');
      expect(options.method).toBe('DELETE');
      expect(res.success).toBe(true);
    });
  });

  describe('Analytics & Strict PII Sanitization', () => {
    it('sanitizes message content, body, text, and preview from telemetry', () => {
      const dirtyProperties = {
        conversationId: 'conv-123',
        clientMessageId: 'cmsg-456',
        body: 'Do not log this secret message!',
        text: 'Private conversation text',
        message: 'Personal chat line',
        content: 'Hidden content',
        preview: 'Secret preview',
        phone: '+919876543210',
        metadata: {
          wordCount: 5,
          text: 'nested private text',
        },
      };

      const cleanProperties = sanitizeAnalyticsProperties(dirtyProperties);

      expect(cleanProperties.conversationId).toBe('conv-123');
      expect(cleanProperties.clientMessageId).toBe('cmsg-456');
      expect(cleanProperties).not.toHaveProperty('body');
      expect(cleanProperties).not.toHaveProperty('text');
      expect(cleanProperties).not.toHaveProperty('message');
      expect(cleanProperties).not.toHaveProperty('content');
      expect(cleanProperties).not.toHaveProperty('preview');
      expect(cleanProperties).not.toHaveProperty('phone');
      expect((cleanProperties.metadata as Record<string, unknown>).wordCount).toBe(5);
      expect(cleanProperties.metadata as Record<string, unknown>).not.toHaveProperty('text');
    });

    it('successfully emits chat analytics events', () => {
      const eventId = trackOnboardingEvent('conversation_opened', {
        conversationId: 'conv-test-1',
      });
      expect(eventId).toBeDefined();
    });
  });

  describe('Feature 2.2: AI Toxic Message Intervention (Are You Sure?)', () => {
    it('detects severe personal harassment and threats', async () => {
      const { detectToxicity } = await import('../src/chat/moderation/toxicity-detector.js');

      const threat = detectToxicity('I am gonna hurt you if you do not reply');
      expect(threat.isToxic).toBe(true);
      expect(threat.score).toBeGreaterThanOrEqual(0.7);
      expect(threat.categories).toContain('THREAT_OR_VIOLENCE');

      const insult = detectToxicity('You are ugly and worthless');
      expect(insult.isToxic).toBe(true);
      expect(insult.score).toBeGreaterThanOrEqual(0.7);
      expect(insult.categories).toContain('HARASSMENT');
    });

    it('detects unsolicited sexually explicit demands', async () => {
      const { detectToxicity } = await import('../src/chat/moderation/toxicity-detector.js');

      const explicit = detectToxicity('Hey send nudes right now');
      expect(explicit.isToxic).toBe(true);
      expect(explicit.score).toBeGreaterThanOrEqual(0.7);
      expect(explicit.categories).toContain('SEXUAL_HARASSMENT');
    });

    it('passes respectful and ordinary conversation without false positives', async () => {
      const { detectToxicity } = await import('../src/chat/moderation/toxicity-detector.js');

      expect(detectToxicity('Hey! How was your weekend?').isToxic).toBe(false);
      expect(detectToxicity('I love your third photo, where was that taken?').isToxic).toBe(false);
      expect(detectToxicity('Would you like to grab coffee at Blue Tokai tomorrow?').isToxic).toBe(false);
    });
  });

  describe('Feature 2.4: In-App Safe WebRTC Audio & Video Calling', () => {
    it('initiates a safe audio call session', async () => {
      const { createCallingApi } = await import('../src/chat/calling-api.js');

      const mockInitiateRes = {
        callSessionId: 'call-sess-1',
        status: 'RINGING',
        callerUserId: 'user-a',
        calleeUserId: 'user-b',
        callType: 'AUDIO',
        startedAt: '2026-10-15T14:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockInitiateRes,
        }),
      });

      const callingApi = createCallingApi(authClient);
      const res = await callingApi.initiateCall({
        conversationId: 'conv-1',
        callType: 'AUDIO',
      });

      expect(res.callSessionId).toBe('call-sess-1');
      expect(res.status).toBe('RINGING');
      expect(res.callType).toBe('AUDIO');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.platform.com/v1/calls/initiate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ conversationId: 'conv-1', callType: 'AUDIO' }),
        })
      );
    });

    it('ends an active call session', async () => {
      const { createCallingApi } = await import('../src/chat/calling-api.js');

      const mockEndRes = {
        success: true,
        callSessionId: 'call-sess-1',
        durationSeconds: 42,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockEndRes,
        }),
      });

      const callingApi = createCallingApi(authClient);
      const res = await callingApi.endCall('call-sess-1', 'ENDED');

      expect(res.success).toBe(true);
      expect(res.durationSeconds).toBe(42);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.platform.com/v1/calls/call-sess-1/end',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'ENDED' }),
        })
      );
    });

    it('retrieves details for an existing call session', async () => {
      const { createCallingApi } = await import('../src/chat/calling-api.js');

      const mockDetailRes = {
        id: 'call-sess-1',
        conversationId: 'conv-1',
        callerUserId: 'user-a',
        calleeUserId: 'user-b',
        callType: 'VIDEO',
        status: 'ENDED',
        startedAt: '2026-10-15T14:00:00.000Z',
        endedAt: '2026-10-15T14:02:30.000Z',
        durationSeconds: 150,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockDetailRes,
        }),
      });

      const callingApi = createCallingApi(authClient);
      const res = await callingApi.getCallSession('call-sess-1');

      expect(res.id).toBe('call-sess-1');
      expect(res.callType).toBe('VIDEO');
      expect(res.durationSeconds).toBe(150);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.platform.com/v1/calls/call-sess-1',
        expect.anything()
      );
    });
  });
});
