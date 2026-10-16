import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInteractionsApi } from '../src/interactions/interactions-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';

describe('Mobile Interactions Layer: API Client & Mutation Operations', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('mobile_test_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('submits a LIKE interaction and parses successful non-match response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            targetUserId: 'target-uuid-123',
            interaction: 'LIKE',
            matched: false,
            matchId: null,
          },
          requestId: 'req-like-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.like('target-uuid-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.platform.com/v1/interactions/target-uuid-123/like');
    expect(options.method).toBe('POST');
    expect(result.matched).toBe(false);
    expect(result.interaction).toBe('LIKE');
  });

  it('submits a LIKE interaction and parses mutual match response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            targetUserId: 'target-uuid-456',
            interaction: 'LIKE',
            matched: true,
            matchId: 'match-uuid-999',
          },
          requestId: 'req-like-002',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.like('target-uuid-456');

    expect(result.matched).toBe(true);
    expect(result.matchId).toBe('match-uuid-999');
  });

  it('submits a LIKE with inline prompt attachment and opening comment', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            targetUserId: 'target-uuid-456',
            interaction: 'LIKE',
            matched: false,
            matchId: null,
            targetAttachmentType: 'PROMPT',
            targetAttachmentId: 'prompt-1',
            comment: 'That is such a cool answer!',
          },
          requestId: 'req-like-003',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.like('target-uuid-456', {
      targetAttachmentType: 'PROMPT',
      targetAttachmentId: 'prompt-1',
      comment: 'That is such a cool answer!',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.platform.com/v1/interactions/target-uuid-456/like');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      targetAttachmentType: 'PROMPT',
      targetAttachmentId: 'prompt-1',
      comment: 'That is such a cool answer!',
    });
    expect(result.targetAttachmentType).toBe('PROMPT');
    expect(result.comment).toBe('That is such a cool answer!');
  });

  it('submits a PASS interaction successfully', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            targetUserId: 'target-uuid-789',
            interaction: 'PASS',
            matched: false,
            matchId: null,
          },
          requestId: 'req-pass-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.pass('target-uuid-789');

    expect(result.interaction).toBe('PASS');
    expect(result.matched).toBe(false);
  });

  it('submits an UNDO interaction successfully', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            undone: true,
            targetUserId: 'target-uuid-789',
            previousInteraction: 'PASS',
          },
          requestId: 'req-undo-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.undo();

    expect(result.undone).toBe(true);
    expect(result.previousInteraction).toBe('PASS');
  });

  it('retrieves user interaction history', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'int-1',
                targetUserId: 'target-uuid-1',
                type: 'LIKE',
                createdAt: new Date().toISOString(),
              },
            ],
          },
          requestId: 'req-hist-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    const result = await api.getHistory(20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('LIKE');
  });

  it('throws an error if like fails on server', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERACTION_SELF_TARGET',
            message: 'A user cannot like themselves',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const api = createInteractionsApi(authClient);
    await expect(api.like('self-id')).rejects.toThrow('A user cannot like themselves');
  });

  describe('Feature 3.1: "Likes You" Grid with Blur & Reveal Entitlement', () => {
    it('retrieves inbound likes with blurred previews when user lacks entitlement', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              totalCount: 5,
              hasEntitlement: false,
              items: [
                {
                  id: 'like-1',
                  actorUserId: 'actor-1',
                  isBlurred: true,
                  targetAttachmentType: 'PROFILE',
                  createdAt: '2026-10-15T18:00:00.000Z',
                  profile: null,
                  blurredPhotoUrl: 'https://cdn.nazar.app/photos/actor-1.jpg',
                },
              ],
              nextCursor: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      const res = await api.getLikesYou();

      expect(res.totalCount).toBe(5);
      expect(res.hasEntitlement).toBe(false);
      expect(res.items[0]?.isBlurred).toBe(true);
      expect(res.items[0]?.profile).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.platform.com/v1/interactions/likes-you',
        expect.anything()
      );
    });

    it('retrieves inbound likes with full unblurred profiles when user has entitlement', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              totalCount: 1,
              hasEntitlement: true,
              items: [
                {
                  id: 'like-1',
                  actorUserId: 'actor-1',
                  isBlurred: false,
                  targetAttachmentType: 'PROMPT',
                  comment: 'Loved your travel story!',
                  createdAt: '2026-10-15T18:00:00.000Z',
                  profile: {
                    id: 'prof-1',
                    userId: 'actor-1',
                    displayName: 'Zara',
                    age: 26,
                    city: 'Delhi',
                    occupation: 'Product Designer',
                    photoUrl: 'https://cdn.nazar.app/photos/zara.jpg',
                    isVerified: true,
                  },
                },
              ],
              nextCursor: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      const res = await api.getLikesYou(20);

      expect(res.totalCount).toBe(1);
      expect(res.hasEntitlement).toBe(true);
      expect(res.items[0]?.isBlurred).toBe(false);
      expect(res.items[0]?.profile?.displayName).toBe('Zara');
      expect(res.items[0]?.comment).toBe('Loved your travel story!');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.platform.com/v1/interactions/likes-you?limit=20',
        expect.anything()
      );
    });
  });
});
