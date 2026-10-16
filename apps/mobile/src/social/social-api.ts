import type {
  PostDto,
  CreatePostRequestDto,
  UpdatePostRequestDto,
  PostFeedResponseDto,
  PostCommentDto,
  CreateCommentRequestDto,
  UpdateCommentRequestDto,
  CommentListResponseDto,
  PostReactionType,
  CommunityDto,
  CreateCommunityRequestDto,
  UpdateCommunityRequestDto,
  CommunityListResponseDto,
  CommunityMemberListResponseDto,
  CommunityRole,
  CommunityMembershipStatus,
  EventDto,
  CreateEventRequestDto,
  UpdateEventRequestDto,
  EventListResponseDto,
  CreateRsvpRequestDto,
  EventRsvpStatus,
  EventAttendeeListResponseDto,
  EventType,
} from '@platform/api-contracts';
import { SocialApiError } from './social-state.js';

export interface SocialApiConfig {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  /** Injectable for tests. Defaults to the global `fetch`. */
  readonly fetchFn?: typeof fetch;
}

interface SocialEnvelopeShape {
  readonly success?: boolean;
  readonly data?: unknown;
  readonly error?: {
    readonly statusCode?: number;
    readonly code?: string;
    readonly message?: string;
    readonly details?: readonly { field: string; message: string; code?: string }[];
  };
  readonly requestId?: string;
}

/**
 * Converts a fetch `Response` into data or a typed {@link SocialApiError}.
 *
 * Previously this threw `new Error(rawServerMessage)`, which discarded the
 * machine-readable `code`. Screens now branch on the code (for example
 * `EVENT_FULL` and `RSVP_NOT_ALLOWED`) instead of string-matching messages.
 */
async function parseSocialResponse<T>(res: Response): Promise<{ success: boolean; data: T }> {
  let body: SocialEnvelopeShape = {};
  try {
    body = (await res.json()) as SocialEnvelopeShape;
  } catch {
    body = {};
  }

  if (res.ok && body.success === true) {
    return { success: true, data: body.data as T };
  }

  if (res.ok && body.data !== undefined) {
    // Tolerate a 200 that omits the envelope flag but still carries data.
    return { success: true, data: body.data as T };
  }

  throw new SocialApiError({
    code: body.error?.code ?? `HTTP_${res.status}`,
    statusCode: body.error?.statusCode ?? res.status,
    message: body.error?.message ?? res.statusText ?? 'Request failed',
    details: body.error?.details ?? [],
    requestId: body.requestId,
  });
}

export class SocialApiClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly config: SocialApiConfig) {
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  private async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T }> {
    const token = await this.config.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await this.fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    return parseSocialResponse<T>(res);
  }

  // ----------------------------------------------------
  // Posts & Feed
  // ----------------------------------------------------

  async createPost(payload: CreatePostRequestDto): Promise<PostDto> {
    const res = await this.fetchWithAuth<PostDto>('/v1/social/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async getFeed(
    query: { limit?: number; cursor?: string; communityId?: string } = {}
  ): Promise<PostFeedResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.communityId) params.set('communityId', query.communityId);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<PostFeedResponseDto>(`/v1/social/feed${queryStr}`);
    return res.data;
  }

  async getPost(id: string): Promise<PostDto> {
    const res = await this.fetchWithAuth<PostDto>(`/v1/social/posts/${id}`);
    return res.data;
  }

  async updatePost(id: string, payload: UpdatePostRequestDto): Promise<PostDto> {
    const res = await this.fetchWithAuth<PostDto>(`/v1/social/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async deletePost(id: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(`/v1/social/posts/${id}`, {
      method: 'DELETE',
    });
    return res.data;
  }

  // ----------------------------------------------------
  // Comments
  // ----------------------------------------------------

  async addComment(postId: string, payload: CreateCommentRequestDto): Promise<PostCommentDto> {
    const res = await this.fetchWithAuth<PostCommentDto>(`/v1/social/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async getComments(
    postId: string,
    query: { limit?: number; cursor?: string } = {}
  ): Promise<CommentListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<CommentListResponseDto>(
      `/v1/social/posts/${postId}/comments${queryStr}`
    );
    return res.data;
  }

  async updateComment(
    commentId: string,
    payload: UpdateCommentRequestDto
  ): Promise<PostCommentDto> {
    const res = await this.fetchWithAuth<PostCommentDto>(`/v1/social/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async deleteComment(commentId: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(`/v1/social/comments/${commentId}`, {
      method: 'DELETE',
    });
    return res.data;
  }

  // ----------------------------------------------------
  // Reactions
  // ----------------------------------------------------

  async addReaction(
    postId: string,
    reactionType: PostReactionType
  ): Promise<{ success: boolean; reactionType: PostReactionType }> {
    const res = await this.fetchWithAuth<{ success: boolean; reactionType: PostReactionType }>(
      `/v1/social/posts/${postId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ reactionType }),
      }
    );
    return res.data;
  }

  async removeReaction(
    postId: string,
    reactionType: PostReactionType
  ): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(
      `/v1/social/posts/${postId}/reactions/${reactionType}`,
      {
        method: 'DELETE',
      }
    );
    return res.data;
  }

  // ----------------------------------------------------
  // Communities
  // ----------------------------------------------------

  async createCommunity(payload: CreateCommunityRequestDto): Promise<CommunityDto> {
    const res = await this.fetchWithAuth<CommunityDto>('/v1/communities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async getUserCommunities(
    query: { limit?: number; cursor?: string } = {}
  ): Promise<CommunityListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<CommunityListResponseDto>(`/v1/communities${queryStr}`);
    return res.data;
  }

  async discoverCommunities(
    query: { limit?: number; cursor?: string } = {}
  ): Promise<CommunityListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<CommunityListResponseDto>(
      `/v1/communities/discover${queryStr}`
    );
    return res.data;
  }

  async getCommunity(id: string): Promise<CommunityDto> {
    const res = await this.fetchWithAuth<CommunityDto>(`/v1/communities/${id}`);
    return res.data;
  }

  async updateCommunity(id: string, payload: UpdateCommunityRequestDto): Promise<CommunityDto> {
    const res = await this.fetchWithAuth<CommunityDto>(`/v1/communities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async joinCommunity(
    id: string
  ): Promise<{ status: CommunityMembershipStatus; role: CommunityRole }> {
    const res = await this.fetchWithAuth<{
      status: CommunityMembershipStatus;
      role: CommunityRole;
    }>(`/v1/communities/${id}/join`, { method: 'POST' });
    return res.data;
  }

  async leaveCommunity(id: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(`/v1/communities/${id}/leave`, {
      method: 'DELETE',
    });
    return res.data;
  }

  async listCommunityMembers(
    id: string,
    query: { limit?: number; cursor?: string } = {}
  ): Promise<CommunityMemberListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<CommunityMemberListResponseDto>(
      `/v1/communities/${id}/members${queryStr}`
    );
    return res.data;
  }

  /** OWNER/ADMIN only. Approves a PENDING membership into ACTIVE. */
  async approveMembership(
    communityId: string,
    userId: string
  ): Promise<{ status: CommunityMembershipStatus }> {
    const res = await this.fetchWithAuth<{ status: CommunityMembershipStatus }>(
      `/v1/communities/${communityId}/members/${userId}/approve`,
      { method: 'POST' }
    );
    return res.data;
  }

  /** OWNER/ADMIN only. Bans an ACTIVE member. */
  async banMember(communityId: string, userId: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(
      `/v1/communities/${communityId}/members/${userId}/ban`,
      { method: 'POST' }
    );
    return res.data;
  }

  async getCommunityFeed(
    id: string,
    query: { limit?: number; cursor?: string } = {}
  ): Promise<PostFeedResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<PostFeedResponseDto>(
      `/v1/communities/${id}/feed${queryStr}`
    );
    return res.data;
  }

  // ----------------------------------------------------
  // Events
  // ----------------------------------------------------

  async createEvent(payload: CreateEventRequestDto): Promise<EventDto> {
    const res = await this.fetchWithAuth<EventDto>('/v1/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async discoverEvents(
    query: { limit?: number; cursor?: string; communityId?: string; type?: EventType } = {}
  ): Promise<EventListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.communityId) params.set('communityId', query.communityId);
    if (query.type) params.set('type', query.type);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<EventListResponseDto>(`/v1/events${queryStr}`);
    return res.data;
  }

  async getEvent(id: string): Promise<EventDto> {
    const res = await this.fetchWithAuth<EventDto>(`/v1/events/${id}`);
    return res.data;
  }

  async updateEvent(id: string, payload: UpdateEventRequestDto): Promise<EventDto> {
    const res = await this.fetchWithAuth<EventDto>(`/v1/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async cancelEvent(id: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(`/v1/events/${id}`, {
      method: 'DELETE',
    });
    return res.data;
  }

  async rsvpEvent(id: string, payload: CreateRsvpRequestDto): Promise<{ status: EventRsvpStatus }> {
    const res = await this.fetchWithAuth<{ status: EventRsvpStatus }>(`/v1/events/${id}/rsvp`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async cancelRsvp(id: string): Promise<{ success: boolean }> {
    const res = await this.fetchWithAuth<{ success: boolean }>(`/v1/events/${id}/rsvp`, {
      method: 'DELETE',
    });
    return res.data;
  }

  async listEventAttendees(
    id: string,
    query: { limit?: number; cursor?: string; plusOnesOnly?: boolean } = {}
  ): Promise<EventAttendeeListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.plusOnesOnly !== undefined) params.set('plusOnesOnly', String(query.plusOnesOnly));

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<EventAttendeeListResponseDto>(
      `/v1/events/${id}/attendees${queryStr}`
    );
    return res.data;
  }
}

export const SOCIAL_QUERY_KEYS = {
  /**
   * Prefix keys. Invalidation matches by key prefix, and a single list key such
   * as `events({ communityId })` is a *sibling* of `events()` rather than a child
   * of it, so invalidating one filtered list would silently leave the others
   * stale. Mutations invalidate these roots instead.
   */
  feedLists: ['social', 'feed'] as const,
  communityLists: ['social', 'communities'] as const,
  eventLists: ['social', 'events'] as const,
  feed: (communityId?: string) => ['social', 'feed', communityId ?? 'global'] as const,
  post: (id: string) => ['social', 'post', id] as const,
  comments: (postId: string) => ['social', 'comments', postId] as const,
  userCommunities: ['social', 'communities', 'user'] as const,
  discoverCommunities: ['social', 'communities', 'discover'] as const,
  community: (id: string) => ['social', 'community', id] as const,
  communityMembers: (id: string) => ['social', 'community', id, 'members'] as const,
  communityFeed: (id: string) => ['social', 'community', id, 'feed'] as const,
  events: (params?: { communityId?: string; type?: string }) =>
    ['social', 'events', params ?? {}] as const,
  event: (id: string) => ['social', 'event', id] as const,
  eventAttendees: (id: string, plusOnesOnly?: boolean) =>
    ['social', 'event', id, 'attendees', { plusOnesOnly: !!plusOnesOnly }] as const,
  /**
   * The detail screen shows a short, non-paginated attendee preview while
   * `eventAttendees` backs an infinite roster. The two cache different shapes,
   * so they must not share a key.
   */
  eventAttendeePreview: (id: string) => ['social', 'event', id, 'attendee-preview'] as const,
  /**
   * The Explore landing page renders short previews of the four main lists.
   * Those are single-page responses with a different shape from the infinite
   * queries on the full screens, so each preview gets its own key instead of
   * poisoning the list caches with partial data.
   */
  homePreview: {
    feed: ['social', 'home', 'feed'] as const,
    events: ['social', 'home', 'events'] as const,
    myCommunities: ['social', 'home', 'my-communities'] as const,
    discoverCommunities: ['social', 'home', 'discover-communities'] as const,
  },
};

import { getDefaultAuthClient } from '../auth/default-client.js';
import type { AuthClient } from '../auth/auth-client.js';

export function createSocialApi(authClient: AuthClient): SocialApiClient {
  return new SocialApiClient({
    baseUrl: authClient.getBaseUrl(),
    getAccessToken: async () => authClient.getStorage().getAccessToken(),
  });
}

let defaultSocialApi: SocialApiClient | null = null;
export function getDefaultSocialApi(): SocialApiClient {
  if (!defaultSocialApi) {
    defaultSocialApi = createSocialApi(getDefaultAuthClient());
  }
  return defaultSocialApi;
}
