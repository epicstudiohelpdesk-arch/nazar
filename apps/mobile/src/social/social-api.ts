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
} from '@platform/api-contracts';

export interface SocialApiConfig {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
}

export class SocialApiClient {
  constructor(private readonly config: SocialApiConfig) {}

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

    const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(
        errorBody?.message || errorBody?.code || `HTTP error ${res.status}: ${res.statusText}`
      );
    }

    return res.json();
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
    query: { limit?: number; cursor?: string; communityId?: string; type?: string } = {}
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
    query: { limit?: number; cursor?: string } = {}
  ): Promise<EventAttendeeListResponseDto> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth<EventAttendeeListResponseDto>(
      `/v1/events/${id}/attendees${queryStr}`
    );
    return res.data;
  }
}
