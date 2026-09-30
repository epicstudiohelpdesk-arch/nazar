import type { DiscoveryResponseDto, DiscoveryQueryDto } from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

export const DISCOVERY_QUERY_KEYS = {
  feed: ['discovery', 'feed'] as const,
  feedWithFilters: (filtersHash: string) => ['discovery', 'feed', filtersHash] as const,
};

export function createDiscoveryApi(authClient: AuthClient) {
  return {
    async getDiscoveryFeed(params: DiscoveryQueryDto = {}): Promise<DiscoveryResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/v1/discovery?${queryString}` : '/v1/discovery';

      const res = await authClient.request<DiscoveryResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve discovery candidates');
      }
      return res.data;
    },
  };
}

export type DiscoveryApi = ReturnType<typeof createDiscoveryApi>;

let defaultDiscoveryApi: DiscoveryApi | null = null;

export function getDefaultDiscoveryApi(): DiscoveryApi {
  if (!defaultDiscoveryApi) {
    defaultDiscoveryApi = createDiscoveryApi(getDefaultAuthClient());
  }
  return defaultDiscoveryApi;
}
