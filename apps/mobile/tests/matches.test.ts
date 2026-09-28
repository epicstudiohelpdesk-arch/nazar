import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMatchesApi } from '../src/matches/matches-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type { MatchListResponseDto, MatchDetailDto } from '@platform/api-contracts';

describe('Mobile Matches Layer: API Client & Data Models', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockMatchesResponse: MatchListResponseDto = {
    items: [
      {
        id: 'match-1',
        matchedAt: '2026-09-28T12:00:00.000Z',
        status: 'ACTIVE',
        otherUser: {
          userId: 'user-b',
          profileId: 'prof-b',
          displayName: 'Zara',
          age: 24,
          city: 'Delhi',
          countryCode: 'IN',
          primaryPhotoUrl: 'https://cdn.example.com/zara.jpg',
        },
      },
    ],
    pagination: {
      nextCursor: 'cursor_xyz',
      hasMore: true,
      limit: 20,
    },
  };

  const mockDetailResponse: MatchDetailDto = {
    id: 'match-1',
    matchedAt: '2026-09-28T12:00:00.000Z',
    status: 'ACTIVE',
    otherUser: {
      userId: 'user-b',
      profileId: 'prof-b',
      displayName: 'Zara',
      age: 24,
      bio: 'Loves jazz and cinema.',
      occupation: 'Curator',
      education: 'Fine Arts Institute',
      city: 'Delhi',
      countryCode: 'IN',
      media: [
        {
          id: 'med-1',
          url: 'https://cdn.example.com/zara.jpg',
          position: 0,
          isPrimary: true,
        },
      ],
      interests: [{ id: 'int-1', name: 'Jazz', slug: 'jazz', category: 'Music' }],
      prompts: [{ id: 'prm-1', prompt: 'Best concert attended', answer: 'Montreux 2024' }],
    },
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('mobile_matches_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('retrieves paginated matches with query parameters', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockMatchesResponse,
          requestId: 'req-matches-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createMatchesApi(authClient);
    const result = await api.getMatches({ limit: 10, cursor: 'prev_cursor' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/v1/matches?limit=10&cursor=prev_cursor');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].otherUser.displayName).toBe('Zara');
    expect(result.pagination.hasMore).toBe(true);
  });

  it('retrieves match detail for a specific matchId', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockDetailResponse,
          requestId: 'req-detail-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createMatchesApi(authClient);
    const result = await api.getMatchDetail('match-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/v1/matches/match-1');
    expect(result.otherUser.displayName).toBe('Zara');
    expect(result.otherUser.bio).toBe('Loves jazz and cinema.');
    expect(result.otherUser.media).toHaveLength(1);
  });

  it('submits an unmatch request successfully', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            success: true,
            matchId: 'match-1',
            status: 'UNMATCHED',
          },
          requestId: 'req-unmatch-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createMatchesApi(authClient);
    const result = await api.unmatch('match-1', { reason: 'USER_INITIATED' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/matches/match-1');
    expect(options.method).toBe('DELETE');
    expect(result.success).toBe(true);
    expect(result.status).toBe('UNMATCHED');
  });

  it('throws an error if unmatch returns a server failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MATCH_ACCESS_DENIED',
            message: 'You are not a member of this match',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createMatchesApi(authClient);
    await expect(api.unmatch('forbidden-match')).rejects.toThrow(
      'You are not a member of this match'
    );
  });
});
