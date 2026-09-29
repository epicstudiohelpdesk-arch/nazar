import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createRecommendationsApi,
  RECOMMENDATIONS_QUERY_KEYS,
} from '../src/recommendations/recommendations-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  RecommendationResponseDto,
  UserRecommendationFeaturesDto,
  RecommendationModelVersionDto,
} from '@platform/api-contracts';

describe('Mobile Recommendations Layer: API Client & Query Keys (Gate 13)', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockResponse: RecommendationResponseDto = {
    items: [
      {
        profile: {
          id: '018f0000-1111-7000-8000-000000000001',
          userId: '018f0000-1111-7000-8000-000000000002',
          displayName: 'Priya',
          age: 26,
          gender: 'WOMAN',
          city: 'Kolkata',
          countryCode: 'IN',
          bio: 'Loves photography and hiking.',
          occupation: 'Architect',
          education: 'Design University',
          interests: [
            { id: 'int-1', name: 'Coffee', slug: 'coffee', category: 'Food' },
            { id: 'int-2', name: 'Hiking', slug: 'hiking', category: 'Outdoors' },
          ],
          prompts: [
            { id: 'prm-1', prompt: 'My ideal Sunday', answer: 'Making brunch and reading.' },
          ],
          media: [
            {
              id: 'med-1',
              url: 'https://cdn.example.com/photos/priya.jpg',
              position: 0,
              isPrimary: true,
            },
          ],
        },
        distanceBucket: '1-5 km',
      },
    ],
    nextCursor: 'mock_next_cursor_xyz',
    hasMore: true,
    recommendationVersion: 'v1',
    mode: 'PERSONALIZED_DISCOVERY',
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('test_access_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('generates deterministic query keys by mode', () => {
    expect(RECOMMENDATIONS_QUERY_KEYS.feed('PERSONALIZED_DISCOVERY')).toEqual([
      'recommendations',
      'feed',
      'PERSONALIZED_DISCOVERY',
    ]);
    expect(RECOMMENDATIONS_QUERY_KEYS.feed('COMMUNITY_DISCOVERY')).toEqual([
      'recommendations',
      'feed',
      'COMMUNITY_DISCOVERY',
    ]);
    expect(RECOMMENDATIONS_QUERY_KEYS.myFeatures).toEqual(['recommendations', 'features', 'me']);
    expect(RECOMMENDATIONS_QUERY_KEYS.models).toEqual(['recommendations', 'models']);
  });

  it('fetches recommendations with query parameters and parses envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockResponse,
          requestId: 'req-rec-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const api = createRecommendationsApi(authClient);
    const result = await api.getRecommendations({
      mode: 'PERSONALIZED_DISCOVERY',
      limit: 10,
      cursor: 'cur_abc',
    });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(
      '/v1/recommendations?mode=PERSONALIZED_DISCOVERY&limit=10&cursor=cur_abc'
    );
    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test_access_token');
  });

  it('retrieves user recommendation features via getMyFeatures()', async () => {
    const mockFeaturesDto: UserRecommendationFeaturesDto = {
      userId: '018f0000-1111-7000-8000-000000000002',
      featureVersion: 'v1',
      features: {
        profileCompleteness: 100,
        photosCount: 3,
        promptsCount: 2,
        interests: ['coffee', 'reading'],
        likesSentCount: 15,
        likesReceivedCount: 10,
        passesCount: 20,
        matchesCount: 5,
        matchRate: 0.3333,
        messagesSentCount: 25,
        messagesReceivedCount: 20,
        replyRate: 1.0,
        conversationsCount: 5,
        postsCount: 2,
        commentsCount: 4,
        reactionsCount: 8,
        communitiesCount: 1,
        eventsJoinedCount: 1,
        recentExposureCount: 0,
      },
      computedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockFeaturesDto,
          requestId: 'req-feat-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const api = createRecommendationsApi(authClient);
    const result = await api.getMyFeatures();

    expect(result.userId).toBe(mockFeaturesDto.userId);
    expect(result.features.matchRate).toBe(0.3333);
  });

  it('lists registered recommendation models via listModels()', async () => {
    const mockModels: RecommendationModelVersionDto[] = [
      {
        id: 'mod-1',
        version: 'v1',
        name: 'DeterministicRecommendationModelV1',
        mode: 'PERSONALIZED_DISCOVERY',
        isActive: true,
        weights: {
          preferenceCompatibility: 0.25,
          sharedInterests: 0.2,
          socialAffinity: 0.15,
          activityFreshness: 0.15,
          profileQuality: 0.15,
          reciprocalSignal: 0.1,
        },
        config: {
          exposurePenaltyPerCount: 0.08,
          maxExposurePenalty: 0.4,
          explorationRate: 0.05,
          freshnessHalfLifeHours: 48,
        },
        rolloutPercentage: 100,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockModels,
          requestId: 'req-models-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const api = createRecommendationsApi(authClient);
    const result = await api.listModels();

    expect(result).toHaveLength(1);
    expect(result[0]!.version).toBe('v1');
    expect(result[0]!.isActive).toBe(true);
  });
});
