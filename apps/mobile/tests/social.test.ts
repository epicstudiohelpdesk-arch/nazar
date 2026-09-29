import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialApiClient } from '../src/social/social-api.js';
import type {
  PostDto,
  PostFeedResponseDto,
  PostCommentDto,
  CommunityDto,
  CommunityListResponseDto,
  EventDto,
  EventListResponseDto,
} from '@platform/api-contracts';

describe('Mobile Social, Communities & Events Client', () => {
  let client: SocialApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockPost: PostDto = {
    id: 'post-1',
    authorId: 'user-author-1',
    author: {
      userId: 'user-author-1',
      displayName: 'Aarav Patel',
      avatarUrl: 'https://cdn.nazar.app/avatars/aarav.jpg',
      bio: 'Photographer & coffee lover',
    },
    communityId: 'comm-1',
    communityName: 'Photography Bangalore',
    content: 'Sunset over Nandi Hills yesterday! Captured with my mirrorless camera.',
    mediaUrls: ['https://cdn.nazar.app/posts/sunset.jpg'],
    visibility: 'PUBLIC',
    likeCount: 42,
    commentCount: 5,
    userReaction: null,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
  };

  const mockCommunity: CommunityDto = {
    id: 'comm-1',
    creatorId: 'user-creator-1',
    name: 'Bangalore Trekkers',
    slug: 'bangalore-trekkers',
    description: 'Weekend hikes, trails, and outdoor adventures around Karnataka.',
    avatarUrl: null,
    coverUrl: null,
    privacy: 'PUBLIC',
    memberCount: 156,
    rules: ['Be respectful', 'Leave no trace on trails'],
    currentUserRole: 'MEMBER',
    currentUserMembershipStatus: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const mockEvent: EventDto = {
    id: 'event-1',
    organizerId: 'user-creator-1',
    organizer: {
      userId: 'user-creator-1',
      displayName: 'Vikram Sharma',
    },
    communityId: 'comm-1',
    communityName: 'Bangalore Trekkers',
    title: 'Sunrise Hike at Skandagiri',
    description: 'Early morning night trek to watch the sunrise above the clouds.',
    coverUrl: null,
    type: 'PHYSICAL',
    status: 'PUBLISHED',
    startAt: '2026-10-05T03:00:00.000Z',
    endAt: '2026-10-05T09:00:00.000Z',
    locationName: 'Skandagiri Trailhead, Chikkaballapur',
    locationAddress: 'Base Camp, Kalavara Village',
    locationUrl: null,
    capacity: 25,
    attendeeCount: 20,
    waitlistCount: 2,
    isWaitlistEnabled: true,
    currentUserRsvp: 'GOING',
    createdAt: '2026-09-28T12:00:00.000Z',
    updatedAt: '2026-09-28T12:00:00.000Z',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    client = new SocialApiClient({
      baseUrl: 'http://localhost:4000',
      getAccessToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    });
  });

  describe('Posts API', () => {
    it('should create a new post with authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPost }),
      });

      const result = await client.createPost({
        content: 'Sunset over Nandi Hills yesterday!',
        visibility: 'PUBLIC',
      });

      expect(result.id).toBe('post-1');
      expect(result.content).toContain('Sunset over Nandi Hills');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/social/posts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should fetch social feed with cursor query', async () => {
      const feedResponse: PostFeedResponseDto = {
        items: [mockPost],
        nextCursor: 'cursor-abc',
        hasMore: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: feedResponse }),
      });

      const feed = await client.getFeed({ limit: 10, cursor: 'prev-cursor' });

      expect(feed.items).toHaveLength(1);
      expect(feed.hasMore).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/social/feed?limit=10&cursor=prev-cursor',
        expect.any(Object)
      );
    });

    it('should add reaction idempotently', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { success: true, reactionType: 'LIKE' } }),
      });

      const res = await client.addReaction('post-1', 'LIKE');
      expect(res.success).toBe(true);
      expect(res.reactionType).toBe('LIKE');
    });

    it('should remove reaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { success: true } }),
      });

      const res = await client.removeReaction('post-1', 'LIKE');
      expect(res.success).toBe(true);
    });
  });

  describe('Comments API', () => {
    it('should add a comment to a post', async () => {
      const mockComment: PostCommentDto = {
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'user-viewer-1',
        author: { userId: 'user-viewer-1', displayName: 'Priya Sharma' },
        parentId: null,
        content: 'Breathtaking view!',
        createdAt: '2026-09-29T10:05:00.000Z',
        updatedAt: '2026-09-29T10:05:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockComment }),
      });

      const comment = await client.addComment('post-1', { content: 'Breathtaking view!' });
      expect(comment.id).toBe('comment-1');
      expect(comment.content).toBe('Breathtaking view!');
    });
  });

  describe('Communities API', () => {
    it('should discover public communities', async () => {
      const commResponse: CommunityListResponseDto = {
        items: [mockCommunity],
        nextCursor: null,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: commResponse }),
      });

      const discover = await client.discoverCommunities();
      expect(discover.items).toHaveLength(1);
      expect(discover.items[0]?.name).toBe('Bangalore Trekkers');
    });

    it('should join community and return active status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { status: 'ACTIVE', role: 'MEMBER' },
        }),
      });

      const res = await client.joinCommunity('comm-1');
      expect(res.status).toBe('ACTIVE');
      expect(res.role).toBe('MEMBER');
    });

    it('should leave community cleanly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { success: true } }),
      });

      const res = await client.leaveCommunity('comm-1');
      expect(res.success).toBe(true);
    });
  });

  describe('Events & RSVP API', () => {
    it('should discover upcoming events', async () => {
      const eventList: EventListResponseDto = {
        items: [mockEvent],
        nextCursor: null,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: eventList }),
      });

      const events = await client.discoverEvents({ type: 'PHYSICAL' });
      expect(events.items).toHaveLength(1);
      expect(events.items[0]?.title).toBe('Sunrise Hike at Skandagiri');
    });

    it('should handle RSVP with GOING status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { status: 'GOING' } }),
      });

      const rsvp = await client.rsvpEvent('event-1', { status: 'GOING' });
      expect(rsvp.status).toBe('GOING');
    });

    it('should handle RSVP cancel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { success: true } }),
      });

      const res = await client.cancelRsvp('event-1');
      expect(res.success).toBe(true);
    });
  });
});
