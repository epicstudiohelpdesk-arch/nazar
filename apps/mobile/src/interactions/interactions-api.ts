import type {
  InteractionResponseDto,
  UndoResponseDto,
  InteractionHistoryResponseDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export const INTERACTIONS_QUERY_KEYS = {
  history: ['interactions', 'history'] as const,
};

export function createInteractionsApi(authClient: AuthClient) {
  return {
    async like(targetUserId: string): Promise<InteractionResponseDto> {
      const res = await authClient.request<InteractionResponseDto>(
        `/v1/interactions/${targetUserId}/like`,
        {
          method: 'POST',
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
