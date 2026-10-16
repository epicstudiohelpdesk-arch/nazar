import type {
  InteractionResponseDto,
  UndoResponseDto,
  InteractionHistoryResponseDto,
  LikesYouResponseDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export const INTERACTIONS_QUERY_KEYS = {
  history: ['interactions', 'history'] as const,
  likesYou: ['interactions', 'likes-you'] as const,
};

export function createInteractionsApi(authClient: AuthClient) {
  return {
    async like(
      targetUserId: string,
      attachmentOptions?: {
        targetAttachmentType?: 'PROFILE' | 'MEDIA' | 'PROMPT';
        targetAttachmentId?: string;
        comment?: string;
      }
    ): Promise<InteractionResponseDto> {
      const res = await authClient.request<InteractionResponseDto>(
        `/v1/interactions/${targetUserId}/like`,
        {
          method: 'POST',
          body: attachmentOptions ? JSON.stringify(attachmentOptions) : undefined,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to submit LIKE interaction');
      }
      return res.data;
    },

    async pass(targetUserId: string): Promise<InteractionResponseDto> {
      const res = await authClient.request<InteractionResponseDto>(
        `/v1/interactions/${targetUserId}/pass`,
        {
          method: 'POST',
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to submit PASS interaction');
      }
      return res.data;
    },

    async undo(): Promise<UndoResponseDto> {
      const res = await authClient.request<UndoResponseDto>('/v1/interactions/undo', {
        method: 'POST',
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to undo last interaction');
      }
      return res.data;
    },

    async getHistory(limit?: number): Promise<InteractionHistoryResponseDto> {
      const query = limit ? `?limit=${limit}` : '';
      const res = await authClient.request<InteractionHistoryResponseDto>(
        `/v1/interactions${query}`
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve interaction history');
      }
      return res.data;
    },

    async getLikesYou(limit?: number): Promise<LikesYouResponseDto> {
      const query = limit ? `?limit=${limit}` : '';
      const res = await authClient.request<LikesYouResponseDto>(
        `/v1/interactions/likes-you${query}`
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve inbound likes');
      }
      return res.data;
    },
  };
}

export type InteractionsApi = ReturnType<typeof createInteractionsApi>;

let defaultInteractionsApi: InteractionsApi | null = null;

export function getDefaultInteractionsApi(): InteractionsApi {
  if (!defaultInteractionsApi) {
    defaultInteractionsApi = createInteractionsApi(getDefaultAuthClient());
  }
  return defaultInteractionsApi;
}
