/**
 * Recommendation & Personalization Engine API Contracts
 * Gate 13: Controlled recommendation architecture, scoring models, and exposure tracking.
 */
import type { DiscoveryItemDto } from '../discovery/discovery.contract.js';

export type RecommendationMode =
  | 'DISCOVERY'
  | 'PERSONALIZED_DISCOVERY'
  | 'SOCIAL_FEED'
  | 'COMMUNITY_DISCOVERY'
  | 'EVENT_DISCOVERY';

export interface RecommendationCursorPayload {
  readonly mode: RecommendationMode;
  readonly version: string;
  readonly lastScore: number;
  readonly lastId: string;
  readonly timestamp: number;
}

export interface RecommendationQueryDto {
  readonly mode?: RecommendationMode;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface RecommendationResponseDto<T = DiscoveryItemDto> {
  readonly items: readonly T[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
  readonly recommendationVersion: string;
  readonly mode: RecommendationMode;
}

/**
 * Normalized Feature Vector (v1)
 * Captured and updated for each user to feed recommendation scoring.
 */
export interface UserFeatureVector {
  // Profile & preference compatibility
  readonly age?: number;
  readonly gender?: string;
  readonly relationshipIntent?: string;
  readonly interests?: readonly string[];
  readonly profileCompleteness?: number;
  readonly photosCount?: number;
  readonly promptsCount?: number;

  // Behavioral signals
  readonly likesSentCount: number;
  readonly likesReceivedCount: number;
  readonly passesCount: number;
  readonly matchesCount: number;
  readonly matchRate: number;
  readonly messagesSentCount: number;
  readonly messagesReceivedCount: number;
  readonly replyRate: number;
  readonly conversationsCount: number;

  // Social engagement signals
  readonly postsCount: number;
  readonly commentsCount: number;
  readonly reactionsCount: number;
  readonly communitiesCount: number;
  readonly eventsJoinedCount: number;

  // Temporal & exposure signals
  readonly lastActiveAt?: string | null;
  readonly profileUpdatedAt?: string | null;
  readonly recentExposureCount?: number;
}

export interface UserRecommendationFeaturesDto {
  readonly userId: string;
  readonly featureVersion: string;
  readonly features: UserFeatureVector;
  readonly computedAt: string;
  readonly updatedAt: string;
}

export interface RecommendationModelVersionDto {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly mode: RecommendationMode;
  readonly isActive: boolean;
  readonly weights: Record<string, number>;
  readonly config: Record<string, unknown>;
  readonly rolloutPercentage: number;
  readonly createdAt: string;
  readonly activatedAt: string;
}

export interface RecommendationExposureDto {
  readonly id: string;
  readonly viewerUserId: string;
  readonly candidateUserId: string;
  readonly recommendationMode: RecommendationMode;
  readonly recommendationVersion: string;
  readonly featureVersion: string;
  readonly rankPosition: number;
  readonly score: number;
  readonly requestId: string;
  readonly surfacedAt: string;
}
