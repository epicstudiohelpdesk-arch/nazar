import type {
  RecommendationResponseDto,
  RecommendationQueryDto,
  RecommendationMode,
  UserRecommendationFeaturesDto,
  RecommendationModelVersionDto,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';

export const RECOMMENDATIONS_QUERY_KEYS = {
  feed: (mode?: RecommendationMode) =>
    ['recommendations', 'feed', mode ?? 'PERSONALIZED_DISCOVERY'] as const,
  myFeatures: ['recommendations', 'features', 'me'] as const,
  models: ['recommendations', 'models'] as const,
};

export function createRecommendationsApi(authClient: AuthClient) {
  return {
    async getRecommendations(
      params: RecommendationQueryDto = {}
    ): Promise<RecommendationResponseDto> {
      const searchParams = new URLSearchParams();
      if (params.mode) {
        searchParams.set('mode', params.mode);
      }
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params.cursor) {
        searchParams.set('cursor', params.cursor);
      }

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/v1/recommendations?${queryString}` : '/v1/recommendations';

      const res = await authClient.request<RecommendationResponseDto>(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve recommendations');
      }
      return res.data;
    },

    async getMyFeatures(): Promise<UserRecommendationFeaturesDto> {
      const res = await authClient.request<UserRecommendationFeaturesDto>(
        '/v1/recommendations/features/me'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to retrieve recommendation features');
      }
      return res.data;
    },

    async listModels(): Promise<readonly RecommendationModelVersionDto[]> {
      const res = await authClient.request<readonly RecommendationModelVersionDto[]>(
        '/v1/recommendations/models'
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to list recommendation models');
      }
      return res.data;
    },
  };
}
