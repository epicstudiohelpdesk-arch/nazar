/**
 * Social, Communities & Events API Contracts
 * Gate 12: Social posts, comments, reactions, community management, and event RSVP engine.
 */

export type PostVisibility = 'PUBLIC' | 'COMMUNITY' | 'FOLLOWERS';
export type PostReactionType = 'LIKE' | 'LOVE' | 'CELEBRATE' | 'SUPPORT' | 'LAUGH';

export type CommunityPrivacy = 'PUBLIC' | 'PRIVATE' | 'HIDDEN';
export type CommunityRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type CommunityMembershipStatus = 'ACTIVE' | 'PENDING' | 'BANNED' | 'LEFT';

export type EventType = 'ONLINE' | 'PHYSICAL';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED' | 'ARCHIVED';
export type EventRsvpStatus = 'GOING' | 'INTERESTED' | 'CANCELLED' | 'WAITLISTED';

export interface SocialAuthorDto {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly bio?: string | null;
}

// ----------------------------------------------------
// Social Posts & Comments
// ----------------------------------------------------

export interface PostDto {
  readonly id: string;
  readonly authorId: string;
  readonly author?: SocialAuthorDto;
  readonly communityId?: string | null;
  readonly communityName?: string | null;
  readonly content: string;
  readonly mediaUrls?: readonly string[];
  readonly visibility: PostVisibility;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly userReaction?: PostReactionType | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePostRequestDto {
  readonly content: string;
  readonly communityId?: string | null;
  readonly mediaIds?: readonly string[];
  readonly visibility?: PostVisibility;
}

export interface UpdatePostRequestDto {
  readonly content?: string;
  readonly visibility?: PostVisibility;
}

export interface PostFeedResponseDto {
  readonly items: readonly PostDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface PostCommentDto {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly author?: SocialAuthorDto;
  readonly parentId?: string | null;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCommentRequestDto {
  readonly content: string;
  readonly parentId?: string | null;
}

export interface UpdateCommentRequestDto {
  readonly content: string;
}

export interface CommentListResponseDto {
  readonly items: readonly PostCommentDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface PostReactionDto {
  readonly id: string;
  readonly postId: string;
  readonly userId: string;
  readonly reactionType: PostReactionType;
  readonly createdAt: string;
}

export interface AddReactionRequestDto {
  readonly reactionType: PostReactionType;
}

export interface ReactionSummaryDto {
  readonly reactionType: PostReactionType;
  readonly count: number;
}

// ----------------------------------------------------
// Communities
// ----------------------------------------------------

export interface CommunityDto {
  readonly id: string;
  readonly creatorId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly avatarUrl?: string | null;
  readonly coverUrl?: string | null;
  readonly privacy: CommunityPrivacy;
  readonly memberCount: number;
  readonly rules?: readonly string[] | null;
  readonly currentUserRole?: CommunityRole | null;
  readonly currentUserMembershipStatus?: CommunityMembershipStatus | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCommunityRequestDto {
  readonly name: string;
  readonly description: string;
  readonly privacy?: CommunityPrivacy;
  readonly rules?: readonly string[];
  readonly avatarMediaId?: string | null;
  readonly coverMediaId?: string | null;
}

export interface UpdateCommunityRequestDto {
  readonly name?: string;
  readonly description?: string;
  readonly privacy?: CommunityPrivacy;
  /**
   * `null` clears the published rules. Omitting the key leaves them untouched,
   * which is what the `PATCH` service distinguishes on.
   */
  readonly rules?: readonly string[] | null;
  readonly avatarMediaId?: string | null;
  readonly coverMediaId?: string | null;
}

export interface CommunityMemberDto {
  readonly id: string;
  readonly communityId: string;
  readonly userId: string;
  readonly user?: SocialAuthorDto;
  readonly role: CommunityRole;
  readonly status: CommunityMembershipStatus;
  readonly joinedAt: string;
}

export interface CommunityMemberListResponseDto {
  readonly items: readonly CommunityMemberDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface CommunityListResponseDto {
  readonly items: readonly CommunityDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

// ----------------------------------------------------
// Events
// ----------------------------------------------------

export interface EventDto {
  readonly id: string;
  readonly organizerId: string;
  readonly organizer?: SocialAuthorDto;
  readonly communityId?: string | null;
  readonly communityName?: string | null;
  readonly title: string;
  readonly description: string;
  readonly coverUrl?: string | null;
  readonly type: EventType;
  readonly status: EventStatus;
  readonly startAt: string;
  readonly endAt: string;
  readonly locationName: string;
  readonly locationAddress?: string | null;
  readonly locationUrl?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly capacity?: number | null;
  readonly attendeeCount: number;
  readonly waitlistCount: number;
  readonly isWaitlistEnabled: boolean;
  readonly currentUserRsvp?: EventRsvpStatus | null;
  readonly currentUserLookingForPlusOne?: boolean;
  readonly currentUserPlusOneNote?: string | null;
  readonly plusOneAttendeeCount?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateEventRequestDto {
  readonly title: string;
  readonly description: string;
  readonly communityId?: string | null;
  readonly type: EventType;
  readonly startAt: string;
  readonly endAt: string;
  readonly locationName: string;
  readonly locationAddress?: string | null;
  readonly locationUrl?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly capacity?: number | null;
  readonly isWaitlistEnabled?: boolean;
  readonly coverMediaId?: string | null;
}

export interface UpdateEventRequestDto {
  readonly title?: string;
  readonly description?: string;
  readonly type?: EventType;
  readonly status?: EventStatus;
  readonly startAt?: string;
  readonly endAt?: string;
  readonly locationName?: string;
  readonly locationAddress?: string | null;
  readonly locationUrl?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly capacity?: number | null;
  readonly isWaitlistEnabled?: boolean;
}

export interface EventRsvpDto {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly user?: SocialAuthorDto;
  readonly status: EventRsvpStatus;
  readonly lookingForPlusOne?: boolean;
  readonly plusOneNote?: string | null;
  readonly promotedFromWaitlistAt?: string | null;
  readonly createdAt: string;
}

export interface CreateRsvpRequestDto {
  readonly status: 'GOING' | 'INTERESTED';
  readonly lookingForPlusOne?: boolean;
  readonly plusOneNote?: string | null;
}

export interface EventAttendeeListResponseDto {
  readonly items: readonly EventRsvpDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface EventListResponseDto {
  readonly items: readonly EventDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}
