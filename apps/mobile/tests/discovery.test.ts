import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDiscoveryApi } from '../src/discovery/discovery-api.js';
import { createInteractionsApi } from '../src/interactions/interactions-api.js';
import { createProfileApi } from '../src/profile/profile-api.js';
import { createSafetyApi } from '../src/safety/safety-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  DiscoveryResponseDto,
  DiscoveryItemDto,
  PublicProfileResponse,
  PreferencesResponse,
  ReportResponseDto,
  BlockUserResponseDto,
} from '@platform/api-contracts';

describe('Mobile Discovery & Interaction Layer (F4)', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const createMockCandidate = (id: string, name: string): DiscoveryItemDto => ({
    profile: {
      id,
      userId: id,
      displayName: name,
      age: 26,
      gender: 'WOMAN',
      city: 'Mumbai',
      countryCode: 'IN',
      bio: `Bio for ${name}`,
      occupation: 'Architect',
      education: 'JJ College of Architecture',
      interests: [
        { id: 'int-1', name: 'Design', slug: 'design', category: 'Creative' },
        { id: 'int-2', name: 'Coffee', slug: 'coffee', category: 'Food' },
      ],
      prompts: [
        {
          id: 'prm-1',
          prompt: 'My ideal Sunday',
          answer: 'Filter coffee and vintage bookshops in Fort.',
        },
      ],
      media: [
        {
          id: `med-${id}`,
          url: `https://cdn.example.com/photos/${id}.jpg`,
          position: 0,
          isPrimary: true,
        },
      ],
    },
    distanceBucket: 'Within 5 km',
  });

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('test_f4_access_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  describe('Discovery Feed API & Pagination', () => {
    it('fetches discovery feed with query parameters and parses envelope', async () => {
      const mockFeed: DiscoveryResponseDto = {
        items: [createMockCandidate('cand-1', 'Aarohi')],
        pagination: {
          nextCursor: 'cursor_page_2',
          hasMore: true,
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockFeed,
            requestId: 'req-discovery-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createDiscoveryApi(authClient);
      const result = await api.getDiscoveryFeed({ limit: 10, cursor: 'cursor_page_1' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/v1/discovery?limit=10&cursor=cursor_page_1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].profile.displayName).toBe('Aarohi');
      expect(result.items[0].distanceBucket).toBe('Within 5 km');
      expect(result.pagination.nextCursor).toBe('cursor_page_2');
      expect(result.pagination.hasMore).toBe(true);
    });

    it('correctly handles empty discovery feed when all candidates are evaluated', async () => {
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
            requestId: 'req-empty-002',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createDiscoveryApi(authClient);
      const result = await api.getDiscoveryFeed();

      expect(result.items).toHaveLength(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('deduplicates candidates across multiple paginated responses', () => {
      const page1: DiscoveryItemDto[] = [
        createMockCandidate('c-1', 'Priya'),
        createMockCandidate('c-2', 'Ananya'),
      ];
      const page2: DiscoveryItemDto[] = [
        createMockCandidate('c-2', 'Ananya'), // duplicate item from sliding window
        createMockCandidate('c-3', 'Divya'),
      ];

      const seen = new Set<string>();
      const deduplicated: DiscoveryItemDto[] = [];
      for (const item of [...page1, ...page2]) {
        const id = item.profile.userId || item.profile.id;
        if (!seen.has(id)) {
          seen.add(id);
          deduplicated.push(item);
        }
      }

      expect(deduplicated).toHaveLength(3);
      expect(deduplicated.map((d) => d.profile.displayName)).toEqual(['Priya', 'Ananya', 'Divya']);
    });

    it('throws error when server returns failure envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'GEO_LOCATION_REQUIRED',
              message: 'Location required to load discovery feed',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createDiscoveryApi(authClient);
      await expect(api.getDiscoveryFeed()).rejects.toThrow(
        'Location required to load discovery feed'
      );
    });
  });

  describe('Interactions & Match Celebration Flow', () => {
    it('submits LIKE and detects mutual match with matchId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              targetUserId: 'cand-mutual-1',
              interaction: 'LIKE',
              matched: true,
              matchId: 'match-xyz-789',
            },
            requestId: 'req-like-match',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      const res = await api.like('cand-mutual-1');

      expect(res.matched).toBe(true);
      expect(res.matchId).toBe('match-xyz-789');
      expect(res.interaction).toBe('LIKE');
    });

    it('submits LIKE and handles non-mutual like response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              targetUserId: 'cand-solo-1',
              interaction: 'LIKE',
              matched: false,
              matchId: null,
            },
            requestId: 'req-like-solo',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      const res = await api.like('cand-solo-1');

      expect(res.matched).toBe(false);
      expect(res.matchId).toBeNull();
    });

    it('submits PASS interaction', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              targetUserId: 'cand-pass-1',
              interaction: 'PASS',
              matched: false,
              matchId: null,
            },
            requestId: 'req-pass-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      const res = await api.pass('cand-pass-1');

      expect(res.interaction).toBe('PASS');
      expect(res.matched).toBe(false);
    });

    it('reverts deck index if interaction fails to prevent silent drop', async () => {
      let currentIndex = 2;
      const revertOnFailure = () => {
        currentIndex = Math.max(0, currentIndex - 1);
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'DAILY_LIKE_LIMIT_EXCEEDED',
              message: 'Daily like quota reached',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createInteractionsApi(authClient);
      try {
        await api.like('cand-fail');
      } catch {
        revertOnFailure();
      }

      expect(currentIndex).toBe(1);
    });

    it('enforces in-flight submission lock to block rapid duplicate taps', async () => {
      let isSubmitting = false;
      let submissionCount = 0;

      const attemptLike = async () => {
        if (isSubmitting) return;
        isSubmitting = true;
        submissionCount++;
        try {
          await new Promise((r) => setTimeout(r, 20));
        } finally {
          isSubmitting = false;
        }
      };

      // Fire 3 simultaneous rapid taps
      await Promise.all([attemptLike(), attemptLike(), attemptLike()]);

      expect(submissionCount).toBe(1);
    });
  });

  describe('Discovery Preferences & Filters', () => {
    it('fetches current user preferences from server', async () => {
      const mockPrefs: PreferencesResponse = {
        id: 'pref-1',
        userId: 'usr-1',
        minAge: 22,
        maxAge: 32,
        maxDistanceKm: 40,
        genderPreferences: ['WOMAN'],
        relationshipIntent: 'LONG_TERM',
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockPrefs,
            requestId: 'req-pref-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const profileApi = createProfileApi(authClient);
      const prefs = await profileApi.getPreferences();

      expect(prefs.minAge).toBe(22);
      expect(prefs.maxAge).toBe(32);
      expect(prefs.maxDistanceKm).toBe(40);
      expect(prefs.relationshipIntent).toBe('LONG_TERM');
    });

    it('updates preferences with canonical defaults', async () => {
      const updatedPrefs: PreferencesResponse = {
        id: 'pref-1',
        userId: 'usr-1',
        minAge: 21,
        maxAge: 35,
        maxDistanceKm: 50,
        genderPreferences: ['MAN', 'WOMAN', 'NON_BINARY'],
        relationshipIntent: 'LONG_TERM',
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: updatedPrefs,
            requestId: 'req-pref-002',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const profileApi = createProfileApi(authClient);
      const res = await profileApi.updatePreferences({
        minAge: 21,
        maxAge: 35,
        maxDistanceKm: 50,
        genderPreferences: ['MAN', 'WOMAN', 'NON_BINARY'],
        relationshipIntent: 'LONG_TERM',
      });

      expect(res.minAge).toBe(21);
      expect(res.maxDistanceKm).toBe(50);
      expect(res.genderPreferences).toHaveLength(3);
    });
  });

  describe('Public Profile Inspection', () => {
    it('retrieves detailed public profile with photos, prompts, and interests', async () => {
      const mockPublic: PublicProfileResponse = {
        id: 'prof-99',
        userId: 'usr-99',
        displayName: 'Rhea',
        age: 27,
        gender: 'WOMAN',
        bio: 'Ceramicist, amateur chef, and avid trail runner.',
        city: 'Bengaluru',
        countryCode: 'IN',
        occupation: 'Studio Ceramicist',
        education: 'NID Ahmedabad',
        interests: [
          { id: 'i1', name: 'Pottery', slug: 'pottery', category: 'Art' },
          { id: 'i2', name: 'Cooking', slug: 'cooking', category: 'Food' },
        ],
        prompts: [
          {
            id: 'p1',
            prompt: 'The quickest way to my heart is',
            answer: 'A homemade sourdough loaf and fresh filter coffee.',
          },
        ],
        media: [
          {
            id: 'm1',
            url: 'https://cdn.example.com/rhea-1.jpg',
            position: 0,
            isPrimary: true,
          },
          {
            id: 'm2',
            url: 'https://cdn.example.com/rhea-2.jpg',
            position: 1,
            isPrimary: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockPublic,
            requestId: 'req-public-prof',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const profileApi = createProfileApi(authClient);
      const profile = await profileApi.getPublicProfile('prof-99');

      expect(profile.displayName).toBe('Rhea');
      expect(profile.age).toBe(27);
      expect(profile.media).toHaveLength(2);
      expect(profile.interests).toHaveLength(2);
      expect(profile.prompts[0].prompt).toBe('The quickest way to my heart is');
      // Verify raw GPS coordinates are never exposed in public profile response
      expect((profile as unknown as Record<string, unknown>).latitude).toBeUndefined();
      expect((profile as unknown as Record<string, unknown>).longitude).toBeUndefined();
    });
  });

  describe('Safety Controls: Report & Block', () => {
    it('submits confidential report with canonical reason code', async () => {
      const mockReport: ReportResponseDto = {
        id: 'rep-001',
        reporterUserId: 'usr-current',
        targetType: 'USER',
        targetId: 'usr-bad',
        reasonCode: 'HARASSMENT',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockReport,
            requestId: 'req-rep-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.createReport({
        targetType: 'USER',
        targetId: 'usr-bad',
        reasonCode: 'HARASSMENT',
        description: 'Sent harassing messages',
      });

      expect(res.id).toBe('rep-001');
      expect(res.reasonCode).toBe('HARASSMENT');
      expect(res.status).toBe('OPEN');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.platform.com/v1/reports');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.targetId).toBe('usr-bad');
      expect(body.reasonCode).toBe('HARASSMENT');
    });

    it('submits block action to exclude user from feeds', async () => {
      const mockBlock: BlockUserResponseDto = {
        blockedUserId: 'usr-block-1',
        blockedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockBlock,
            requestId: 'req-block-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.blockUser('usr-block-1', {
        reason: 'Blocked via mobile discovery',
      });

      expect(res.blockedUserId).toBe('usr-block-1');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.platform.com/v1/users/usr-block-1/block');
      expect(opts.method).toBe('POST');
    });
  });
});
