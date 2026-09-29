import type { RecommendationMode, UserFeatureVector } from '@platform/api-contracts';
import type {
  CandidateRecord,
  DiscoveryViewerContext,
} from '../../discovery/domain/discovery.types.js';

export interface RecommendationRankingWeights {
  readonly preferenceCompatibility: number; // default 0.25
  readonly sharedInterests: number; // default 0.20
  readonly socialAffinity: number; // default 0.15
  readonly activityFreshness: number; // default 0.15
  readonly profileQuality: number; // default 0.15
  readonly reciprocalSignal: number; // default 0.10
}

export interface RecommendationRankingConfig {
  readonly version: string;
  readonly weights: RecommendationRankingWeights;
  readonly exposurePenaltyPerCount: number; // default 0.08
  readonly maxExposurePenalty: number; // default 0.40
  readonly explorationRate: number; // default 0.05
  readonly freshnessHalfLifeHours: number; // default 48
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationRankingConfig = {
  version: 'v1',
  weights: {
    preferenceCompatibility: 0.25,
    sharedInterests: 0.2,
    socialAffinity: 0.15,
    activityFreshness: 0.15,
    profileQuality: 0.15,
    reciprocalSignal: 0.1,
  },
  exposurePenaltyPerCount: 0.08,
  maxExposurePenalty: 0.4,
  explorationRate: 0.05,
  freshnessHalfLifeHours: 48,
};

export interface RecommendationContext {
  readonly viewerUserId: string;
  readonly viewerContext: DiscoveryViewerContext;
  readonly viewerFeatures?: UserFeatureVector | null;
  readonly mode: RecommendationMode;
  readonly requestId: string;
  readonly recommendationVersion: string;
  readonly featureVersion: string;
  readonly referenceTime: Date;
  readonly config: RecommendationRankingConfig;
}

export interface CandidateWithFeatures {
  readonly candidate: CandidateRecord;
  readonly features?: UserFeatureVector | null;
  readonly recentExposuresCount: number;
  readonly sharedCommunitiesCount: number;
  readonly sharedEventsCount: number;
}

export interface ScoreBreakdown {
  readonly preferenceCompatibility: number;
  readonly sharedInterests: number;
  readonly socialAffinity: number;
  readonly activityFreshness: number;
  readonly profileQuality: number;
  readonly reciprocalSignal: number;
  readonly explorationBoost: number;
  readonly exposurePenalty: number;
}

export interface ScoredRecommendationCandidate {
  readonly candidate: CandidateRecord;
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly tieBreaker: string;
}

export const RECOMMENDATION_MODEL_TOKEN = Symbol('RECOMMENDATION_MODEL_TOKEN');

export interface IRecommendationModel {
  readonly version: string;
  score(
    context: RecommendationContext,
    candidates: readonly CandidateWithFeatures[]
  ): readonly ScoredRecommendationCandidate[];
}
