import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDiscoveryApi } from '../src/discovery/discovery-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type { DiscoveryResponseDto, DiscoveryItemDto } from '@platform/api-contracts';

describe('Mobile Discovery Layer: API Client & Data Models', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockItem: DiscoveryItemDto = {
    profile: {
      id: '018f0000-1111-7000-8000-000000000001',
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
      prompts: [{ id: 'prm-1', prompt: 'My ideal Sunday', answer: 'Making brunch and reading.' }],
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
  };

  const mockFeedResponse: DiscoveryResponseDto = {
    items: [mockItem],
    pagination: {
      nextCursor: 'mock_next_cursor_v1_xyz',
      hasMore: true,
    },
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

  it('fetches discovery feed with query parameters and parses envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: mockFeedResponse,
          requestId: 'req-discovery-123',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createDiscoveryApi(authClient);
    const result = await api.getDiscoveryFeed({ limit: 10, cursor: 'prev_cursor_abc' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/v1/discovery?limit=10&cursor=prev_cursor_abc');

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test_access_token');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].profile.displayName).toBe('Priya');
    expect(result.items[0].distanceBucket).toBe('1-5 km');
    expect(result.pagination.nextCursor).toBe('mock_next_cursor_v1_xyz');
    expect(result.pagination.hasMore).toBe(true);
  });

  it('throws an error if discovery API returns failure envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PROFILE_NOT_READY',
            message: 'Your profile must be active to discover matches',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createDiscoveryApi(authClient);

    await expect(api.getDiscoveryFeed()).rejects.toThrow(
      'Your profile must be active to discover matches'
    );
  });

  it('correctly handles empty discovery feed with hasMore=false and nextCursor=null', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [],
            pagination: {
              nextCursor: null,
              hasMore: false,
            },
          },
          requestId: 'req-empty-456',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createDiscoveryApi(authClient);
    const result = await api.getDiscoveryFeed();

    expect(result.items).toHaveLength(0);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });
});
