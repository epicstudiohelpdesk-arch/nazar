import type {
  ConversationListResponseDto,
  ConversationDetailDto,
  MessageListResponseDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
  MarkReadResponseDto,
  SyncMessagesResponseDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';

export const CHAT_QUERY_KEYS = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
};

export function createChatApi(authClient: AuthClient) {
  return {
    async getConversations(
      params: { limit?: number; cursor?: string } = {}
    ): Promise<ConversationListResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString
        ? `/v1/conversations?${queryString}`
        : '/v1/conversations';

      const res = await authClient.request<ConversationListResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve conversations');
      }
      return res.data;
    },

    async getConversationDetail(conversationId: string): Promise<ConversationDetailDto> {
      const res = await authClient.request<ConversationDetailDto>(
        `/v1/conversations/${conversationId}`
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve conversation details');
      }
      return res.data;
    },

    async getMessages(
      conversationId: string,
      params: { limit?: number; cursor?: string } = {}
    ): Promise<MessageListResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString
        ? `/v1/conversations/${conversationId}/messages?${queryString}`
        : `/v1/conversations/${conversationId}/messages`;

      const res = await authClient.request<MessageListResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve messages');
      }
      return res.data;
    },

    async sendMessage(
      conversationId: string,
      payload: SendMessageRequestDto
    ): Promise<SendMessageResponseDto> {
      const res = await authClient.request<SendMessageResponseDto>(
        `/v1/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to send message');
      }
      return res.data;
    },

    async markRead(
      conversationId: string,
      messageId: string
    ): Promise<MarkReadResponseDto> {
      const res = await authClient.request<MarkReadResponseDto>(
        `/v1/conversations/${conversationId}/read`,
        {
          method: 'POST',
          body: JSON.stringify({ messageId }),
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to mark message as read');
      }
      return res.data;
    },

    async syncMessages(
      conversationId: string,
      params: { sinceMessageId?: string; limit?: number } = {}
    ): Promise<SyncMessagesResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.sinceMessageId) {
        searchParams.set('sinceMessageId', params.sinceMessageId);
      }
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }

      const queryString = searchParams.toString();
      const endpoint = queryString
        ? `/v1/conversations/${conversationId}/sync?${queryString}`
        : `/v1/conversations/${conversationId}/sync`;

      const res = await authClient.request<SyncMessagesResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to sync missed messages');
      }
      return res.data;
    },
  };
}

export type ChatApi = ReturnType<typeof createChatApi>;
