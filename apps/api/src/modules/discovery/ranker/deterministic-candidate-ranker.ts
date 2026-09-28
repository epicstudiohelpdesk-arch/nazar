import { Injectable, Inject, Optional } from '@nestjs/common';
import crypto from 'node:crypto';
import { CLOCK_TOKEN, type IClock } from '../../../infrastructure/time/clock.interface.js';
import type {
  CandidateRecord,
  CandidateRankingFeatures,
  DiscoveryViewerContext,
  RankedCandidate,
} from '../domain/discovery.types.js';
import type { ICandidateRanker } from './candidate-ranker.interface.js';

export interface RankingWeights {
  readonly preferenceWeight: number; // default 0.35
  readonly completenessWeight: number; // default 0.25
  readonly freshnessWeight: number; // default 0.20
  readonly distanceWeight: number; // default 0.20
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  preferenceWeight: 0.35,
  completenessWeight: 0.25,
  freshnessWeight: 0.2,
  distanceWeight: 0.2,
};

@Injectable()
export class DeterministicCandidateRanker implements ICandidateRanker {
  private readonly weights: RankingWeights;

  constructor(
    @Optional()
    @Inject(CLOCK_TOKEN)
    private readonly clock?: IClock
  ) {
    this.weights = DEFAULT_RANKING_WEIGHTS;
  }

  rank(
    candidates: readonly CandidateRecord[],
    context: DiscoveryViewerContext
  ): readonly RankedCandidate[] {
    const referenceTime = this.clock ? this.clock.now() : new Date();

    const scoredCandidates: RankedCandidate[] = candidates.map((candidate) => {
      const features = this.calculateFeatures(candidate, context, referenceTime);
      return {
        candidate,
        features,
        score: features.finalScore,
        tieBreaker: candidate.profileId,
      };
    });

    // Deterministic sorting:
    // 1. Final score descending (higher quality / match rank first)
    // 2. Stable secondary key: profileId ascending (lexicographical UUID order)
    return scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.tieBreaker.localeCompare(b.tieBreaker);
    });
  }

  calculateFeatures(
    candidate: CandidateRecord,
    context: DiscoveryViewerContext,
    now: Date
  ): CandidateRankingFeatures {
    // 1. Preference Compatibility Score (0.0 to 1.0)
    const preferenceCompatibilityScore = this.calculatePreferenceCompatibility(candidate, context);

    // 2. Profile Completeness Score (0.0 to 1.0)
    const profileCompletenessScore = Math.min(
      1.0,
      Math.max(0.0, (candidate.completionStatus?.percentage ?? 50) / 100)
    );

    // 3. Freshness Score (0.0 to 1.0)
    const freshnessScore = this.calculateFreshness(candidate, now);

    // 4. Distance Score (0.0 to 1.0)
    const distanceScore = this.calculateDistanceScore(candidate, context);

    // 5. Diversity Adjustment (0.0 to 0.05) - deterministic pseudo-variation
    const diversityAdjustment = this.calculateDiversityAdjustment(
      context.userId,
      candidate.userId,
      now
    );

    // Weighted combination
    const rawScore =
      preferenceCompatibilityScore * this.weights.preferenceWeight +
      profileCompletenessScore * this.weights.completenessWeight +
      freshnessScore * this.weights.freshnessWeight +
      distanceScore * this.weights.distanceWeight +
      diversityAdjustment;

    // Normalization & precision rounding
    const finalScore = Math.round(Math.min(1.0, Math.max(0.0, rawScore)) * 10000) / 10000;

    return {
      preferenceCompatibilityScore: Math.round(preferenceCompatibilityScore * 10000) / 10000,
      profileCompletenessScore: Math.round(profileCompletenessScore * 10000) / 10000,
      freshnessScore: Math.round(freshnessScore * 10000) / 10000,
      distanceScore: Math.round(distanceScore * 10000) / 10000,
      diversityAdjustment: Math.round(diversityAdjustment * 10000) / 10000,
      finalScore,
    };
  }

  private calculatePreferenceCompatibility(
    candidate: CandidateRecord,
    context: DiscoveryViewerContext
  ): number {
    // A. Intent compatibility (60% of pref score)
    let intentScore = 0.4;
    if (candidate.candidateRelationshipIntent === context.relationshipIntent) {
      intentScore = 1.0;
    } else if (
      candidate.candidateRelationshipIntent === 'NOT_SURE' ||
      context.relationshipIntent === 'NOT_SURE'
    ) {
      intentScore = 0.7;
    } else if (
      (candidate.candidateRelationshipIntent === 'LONG_TERM' &&
        context.relationshipIntent === 'SHORT_TERM') ||
      (candidate.candidateRelationshipIntent === 'SHORT_TERM' &&
        context.relationshipIntent === 'LONG_TERM')
    ) {
      intentScore = 0.5;
    }

    // B. Age range centering (40% of pref score)
    let ageScore = 0.5;
    const range = context.maxAge - context.minAge;
    if (range > 0) {
      const midpoint = (context.minAge + context.maxAge) / 2;
      const distanceFromCenter = Math.abs(candidate.age - midpoint);
      const halfRange = range / 2;
      ageScore = Math.max(0.2, 1.0 - (distanceFromCenter / halfRange) * 0.5);
    }

    return intentScore * 0.6 + ageScore * 0.4;
  }

  private calculateFreshness(candidate: CandidateRecord, now: Date): number {
    const updatedAt = candidate.updatedAt ? new Date(candidate.updatedAt) : new Date();
    const diffMs = Math.max(0, now.getTime() - updatedAt.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24) {
      return 1.0;
    }
    if (diffHours <= 72) {
      return 0.85;
    }
    const diffDays = diffHours / 24;
    if (diffDays <= 7) {
      return 0.7;
    }
    if (diffDays <= 30) {
      return 0.5;
    }
    if (diffDays <= 90) {
      return 0.3;
    }
    return Math.max(0.1, 0.3 - ((diffDays - 90) / 275) * 0.2);
  }

  private calculateDistanceScore(
    candidate: CandidateRecord,
    context: DiscoveryViewerContext
  ): number {
    if (
      candidate.distanceMeters === null ||
      candidate.distanceMeters === undefined ||
      Number.isNaN(candidate.distanceMeters)
    ) {
      // Neutral score when location is unavailable
      return 0.5;
    }

    const maxDistanceMeters = (context.maxDistanceKm || 50) * 1000;
    if (maxDistanceMeters <= 0) return 0.5;

    // Linear proximity reward: 1.0 at 0 distance, 0.0 at maximum distance
    const proximity = 1.0 - candidate.distanceMeters / maxDistanceMeters;
    return Math.max(0.0, Math.min(1.0, proximity));
  }

  private calculateDiversityAdjustment(viewerId: string, candidateId: string, now: Date): number {
    // Deterministic day-bounded micro-variation (max 0.03) to prevent static starvation
    const dateKey = now.toISOString().slice(0, 10);
    const hash = crypto
      .createHash('sha256')
      .update(`${viewerId}:${candidateId}:${dateKey}`)
      .digest('hex');

    const num = parseInt(hash.slice(0, 4), 16);
    return (num % 300) / 10000; // between 0.0000 and 0.0299
  }
}
