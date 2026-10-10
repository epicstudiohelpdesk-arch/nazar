import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMatchesApi, MATCHES_QUERY_KEYS } from '../src/matches/matches-api.js';
import { createInteractionsApi } from '../src/interactions/interactions-api.js';
import { createChatApi } from '../src/chat/chat-api.js';
import { createSafetyApi } from '../src/safety/safety-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  MatchListResponseDto,
  MatchDetailDto,
  MatchItemDto,
  ConversationListResponseDto,
  BlockUserResponseDto,
  ReportResponseDto,
} from '@platform/api-contracts';

describe('Mobile Matches & Connection Layer (F5)', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const createMockMatchItem = (id: string, name: string): MatchItemDto => ({
    id,
    matchedAt: '2026-09-30T10:00:00.000Z',
    status: 'ACTIVE',
    otherUser: {
      userId: `usr-${id}`,
      profileId: `prof-${id}`,
      displayName: name,
      age: 26,
      city: 'Mumbai',
      countryCode: 'IN',
      primaryPhotoUrl: `https://cdn.example.com/photos/${id}.jpg`,
    },
  });

  const mockDetailResponse: MatchDetailDto = {
    id: 'match-001',
    matchedAt: '2026-09-30T09:30:00.000Z',
    status: 'ACTIVE',
    otherUser: {
      userId: 'usr-target-1',
      profileId: 'prof-target-1',
      displayName: 'Meera',
      age: 25,
      bio: 'Classical dancer and indie filmmaker.',
      occupation: 'Filmmaker',
      education: 'FTII Pune',
      city: 'Mumbai',
      countryCode: 'IN',
      media: [
        {
          id: 'med-1',
          url: 'https://cdn.example.com/photos/meera-1.jpg',
          position: 0,
          isPrimary: true,
        },
        {
          id: 'med-2',
          url: 'https://cdn.example.com/photos/meera-2.jpg',
          position: 1,
          isPrimary: false,
        },
      ],
      interests: [
        { id: 'int-1', name: 'Cinema', slug: 'cinema', category: 'Arts' },
        { id: 'int-2', name: 'Dance', slug: 'dance', category: 'Performing' },
      ],
      prompts: [
        {
          id: 'prm-1',
          prompt: 'A life goal of mine is',
          answer: 'Screening an indie feature at Cannes.',
        },
      ],
    },
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('f5_mobile_test_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  describe('Matches Query & Cursor Pagination', () => {
    it('retrieves paginated matches with cursor and limit', async () => {
      const mockList: MatchListResponseDto = {
        items: [createMockMatchItem('m-1', 'Meera')],
        pagination: {
          nextCursor: 'cursor_page_2',
          hasMore: true,
          limit: 20,
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockList,
            requestId: 'req-matches-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      const result = await api.getMatches({ limit: 20, cursor: 'cursor_page_1' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/matches?limit=20&cursor=cursor_page_1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].otherUser.displayName).toBe('Meera');
      expect(result.pagination.nextCursor).toBe('cursor_page_2');
      expect(result.pagination.hasMore).toBe(true);
    });

    it('deduplicates matches across multiple paginated pages', () => {
      const page1: MatchItemDto[] = [
        createMockMatchItem('m-1', 'Meera'),
        createMockMatchItem('m-2', 'Ananya'),
      ];
      const page2: MatchItemDto[] = [
        createMockMatchItem('m-2', 'Ananya'), // Duplicate from sliding cursor window
        createMockMatchItem('m-3', 'Pooja'),
      ];

      const seen = new Set<string>();
      const deduplicated: MatchItemDto[] = [];
      for (const item of [...page1, ...page2]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          deduplicated.push(item);
        }
      }

      expect(deduplicated).toHaveLength(3);
      expect(deduplicated.map((m) => m.otherUser.displayName)).toEqual([
        'Meera',
        'Ananya',
        'Pooja',
      ]);
    });

    it('handles empty match list when user has no mutual matches', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [],
              pagination: {
                nextCursor: null,
                hasMore: false,
                limit: 20,
              },
            },
            requestId: 'req-empty-matches',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      const result = await api.getMatches();

      expect(result.items).toHaveLength(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('throws error when match query returns server error envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve matches from database',
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      await expect(api.getMatches()).rejects.toThrow('Failed to retrieve matches from database');
    });
  });

  describe('Match Detail Inspection', () => {
    it('retrieves detailed match profile by matchId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockDetailResponse,
            requestId: 'req-detail-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      const result = await api.getMatchDetail('match-001');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/v1/matches/match-001');
      expect(result.otherUser.displayName).toBe('Meera');
      expect(result.otherUser.occupation).toBe('Filmmaker');
      expect(result.otherUser.media).toHaveLength(2);
      expect(result.otherUser.prompts[0].prompt).toBe('A life goal of mine is');
    });

    it('throws 403 when user is not authorized to view the match', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'MATCH_ACCESS_DENIED',
              message: 'You are not a member of this match',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      await expect(api.getMatchDetail('foreign-match')).rejects.toThrow(
        'You are not a member of this match'
      );
    });
  });

  describe('Connection Management: Unmatch, Block, Report', () => {
    it('submits unmatch request and transitions match status', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              success: true,
              matchId: 'match-001',
              status: 'UNMATCHED',
            },
            requestId: 'req-unmatch-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const api = createMatchesApi(authClient);
      const result = await api.unmatch('match-001', { reason: 'USER_INITIATED' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('UNMATCHED');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.platform.com/v1/matches/match-001');
      expect(options.method).toBe('DELETE');
      const body = JSON.parse(options.body);
      expect(body.reason).toBe('USER_INITIATED');
    });

    it('submits block action against matched user', async () => {
      const mockBlockRes: BlockUserResponseDto = {
        blockedUserId: 'usr-target-1',
        blockedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockBlockRes,
            requestId: 'req-block-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.blockUser('usr-target-1', {
        reason: 'Blocked from match detail view',
      });

      expect(res.blockedUserId).toBe('usr-target-1');
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/users/usr-target-1/block');
      expect(options.method).toBe('POST');
    });

    it('submits confidential report against matched user', async () => {
      const mockReportRes: ReportResponseDto = {
        id: 'rep-999',
        reporterUserId: 'usr-current',
        targetType: 'USER',
        targetId: 'usr-target-1',
        reasonCode: 'HARASSMENT',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockReportRes,
            requestId: 'req-rep-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const safetyApi = createSafetyApi(authClient);
      const res = await safetyApi.createReport({
        targetType: 'USER',
        targetId: 'usr-target-1',
        reasonCode: 'HARASSMENT',
        description: 'Inappropriate conduct in match profile',
      });

      expect(res.id).toBe('rep-999');
      expect(res.status).toBe('OPEN');
    });
  });

  describe('Conversation Lookup & Chat Entry', () => {
    it('looks up existing conversation for a match before opening chat', async () => {
      const mockConversations: ConversationListResponseDto = {
        items: [
          {
            id: 'conv-abc-123',
            matchId: 'match-001',
            status: 'ACTIVE',
            otherUser: {
              userId: 'usr-target-1',
              displayName: 'Meera',
              primaryPhotoUrl: 'https://cdn.example.com/meera.jpg',
            },
            unreadCount: 0,
            createdAt: '2026-09-30T09:30:00.000Z',
            updatedAt: '2026-09-30T09:30:00.000Z',
          },
        ],
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: mockConversations,
            requestId: 'req-convs-001',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const chatApi = createChatApi(authClient);
      const res = await chatApi.getConversations();

      const matchedConv = res.items.find((c) => c.matchId === 'match-001');
      expect(matchedConv).toBeDefined();
      expect(matchedConv?.id).toBe('conv-abc-123');
    });
  });

  describe('Like-Back & Mutual Match Creation Flow', () => {
    it('forms mutual match on like-back and receives matchId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              targetUserId: 'usr-incoming-like',
              interaction: 'LIKE',
              matched: true,
              matchId: 'match-new-555',
            },
            requestId: 'req-likeback',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const interactionsApi = createInteractionsApi(authClient);
      const res = await interactionsApi.like('usr-incoming-like');

      expect(res.matched).toBe(true);
      expect(res.matchId).toBe('match-new-555');
    });

    it('reverts optimistic state if like-back mutation fails', async () => {
      let isMatched = false;
      const revertOnFailure = () => {
        isMatched = false;
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'Rate limit exceeded',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const interactionsApi = createInteractionsApi(authClient);
      try {
        await interactionsApi.like('usr-fail');
        isMatched = true;
      } catch {
        revertOnFailure();
      }

      expect(isMatched).toBe(false);
    });
  });

  describe('Query Keys & Cache Contracts', () => {
    it('provides structured, predictable query keys for cache invalidation', () => {
      expect(MATCHES_QUERY_KEYS.all).toEqual(['matches']);
      expect(MATCHES_QUERY_KEYS.list).toEqual(['matches', 'list']);
      expect(MATCHES_QUERY_KEYS.detail('m-123')).toEqual(['matches', 'detail', 'm-123']);
    });
  });
});
