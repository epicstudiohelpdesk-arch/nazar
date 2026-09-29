import type {
  MatchListResponseDto,
  MatchDetailDto,
  UnmatchResponseDto,
  UnmatchRequestDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';

export const MATCHES_QUERY_KEYS = {
  all: ['matches'] as const,
  list: ['matches', 'list'] as const,
  detail: (id: string) => ['matches', 'detail', id] as const,
};

export function createMatchesApi(authClient: AuthClient) {
  return {
    async getMatches(
      params: { limit?: number; cursor?: string } = {}
    ): Promise<MatchListResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/v1/matches?${queryString}` : '/v1/matches';

      const res = await authClient.request<MatchListResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve matches');
      }
      return res.data;
    },

    async getMatchDetail(matchId: string): Promise<MatchDetailDto> {
      const res = await authClient.request<MatchDetailDto>(`/v1/matches/${matchId}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve match details');
      }
      return res.data;
    },

    async unmatch(matchId: string, payload?: UnmatchRequestDto): Promise<UnmatchResponseDto> {
      const res = await authClient.request<UnmatchResponseDto>(`/v1/matches/${matchId}`, {
        method: 'DELETE',
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to unmatch user');
      }
      return res.data;
    },
  };
}

export type MatchesApi = ReturnType<typeof createMatchesApi>;
