import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import type {
  IRecommendationModel,
  RecommendationContext,
  CandidateWithFeatures,
  ScoredRecommendationCandidate,
  ScoreBreakdown,
} from './recommendation-model.interface.js';

@Injectable()
export class DeterministicRecommendationModelV1 implements IRecommendationModel {
  readonly version = 'v1';

  score(
    context: RecommendationContext,
    candidates: readonly CandidateWithFeatures[]
  ): readonly ScoredRecommendationCandidate[] {
    const scoredList: ScoredRecommendationCandidate[] = candidates.map((item) => {
      const breakdown = this.calculateBreakdown(context, item);
      const w = context.config.weights;

      const weightedSum =
        breakdown.preferenceCompatibility * w.preferenceCompatibility +
        breakdown.sharedInterests * w.sharedInterests +
        breakdown.socialAffinity * w.socialAffinity +
        breakdown.activityFreshness * w.activityFreshness +
        breakdown.profileQuality * w.profileQuality +
        breakdown.reciprocalSignal * w.reciprocalSignal;

      const rawScore = weightedSum + breakdown.explorationBoost - breakdown.exposurePenalty;
      const finalScore = Number(Math.max(0.0001, Math.min(0.9999, rawScore)).toFixed(4));

      return {
        candidate: item.candidate,
        score: finalScore,
        breakdown,
        tieBreaker: item.candidate.profileId,
      };
    });

    // Deterministic stable sorting:
    // 1. Score descending
    // 2. Tie breaker: profileId ascending (lexicographical string comparison)
    return scoredList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.tieBreaker.localeCompare(b.tieBreaker);
    });
  }

  private calculateBreakdown(
    context: RecommendationContext,
    item: CandidateWithFeatures
  ): ScoreBreakdown {
    const { candidate, features, recentExposuresCount, sharedCommunitiesCount, sharedEventsCount } =
      item;
    const { viewerContext, referenceTime, config } = context;

    // 1. Preference Compatibility (0.0 to 1.0)
    let ageScore = 1.0;
    if (viewerContext.minAge && viewerContext.maxAge && candidate.age) {
      const targetMidAge = (viewerContext.minAge + viewerContext.maxAge) / 2;
      const ageDiff = Math.abs(candidate.age - targetMidAge);
      const span = Math.max(1, (viewerContext.maxAge - viewerContext.minAge) / 2);
      ageScore = Math.max(0, 1.0 - ageDiff / span);
    }

    const genderScore =
      viewerContext.genderPreferences && viewerContext.genderPreferences.includes(candidate.gender)
        ? 1.0
        : 0.5;

    const intentScore =
      viewerContext.relationshipIntent && candidate.candidateRelationshipIntent
        ? viewerContext.relationshipIntent === candidate.candidateRelationshipIntent
          ? 1.0
          : 0.5
        : 0.7;

    let distanceScore = 0.5;
    if (candidate.distanceMeters !== null && candidate.distanceMeters !== undefined) {
      const maxDistanceMeters = (viewerContext.maxDistanceKm || 50) * 1000;
      distanceScore = Math.max(0, 1.0 - candidate.distanceMeters / maxDistanceMeters);
    }

    const preferenceCompatibility = Number(
      (ageScore * 0.3 + genderScore * 0.3 + intentScore * 0.2 + distanceScore * 0.2).toFixed(4)
    );

    // 2. Shared Interests (Jaccard similarity: 0.0 to 1.0)
    let sharedInterests = 0.2; // default neutral
    const viewerInterests = new Set(context.viewerFeatures?.interests || []);
    const candidateInterests = new Set(features?.interests || []);

    if (viewerInterests.size > 0 || candidateInterests.size > 0) {
      let intersection = 0;
      for (const id of candidateInterests) {
        if (viewerInterests.has(id)) intersection++;
      }
      const union = new Set([...viewerInterests, ...candidateInterests]).size;
      sharedInterests = union > 0 ? Number((intersection / union).toFixed(4)) : 0.2;
    }

    // 3. Social Affinity (0.0 to 1.0)
    const commAffinity = Math.min(1.0, sharedCommunitiesCount * 0.5);
    const eventAffinity = Math.min(1.0, sharedEventsCount * 0.5);
    const socialAffinity = Number(((commAffinity + eventAffinity) / 2).toFixed(4));

    // 4. Activity Freshness (Exponential decay: 0.05 to 1.0)
    const candidateUpdated = candidate.updatedAt ? new Date(candidate.updatedAt) : referenceTime;
    const deltaMs = Math.max(0, referenceTime.getTime() - candidateUpdated.getTime());
    const deltaHours = deltaMs / (1000 * 60 * 60);
    const halfLife = config.freshnessHalfLifeHours ?? 48;
    const activityFreshness = Number(
      Math.max(0.05, Math.min(1.0, Math.exp(-Math.LN2 * (deltaHours / halfLife)))).toFixed(4)
    );

    // 5. Profile Quality & Completeness (0.0 to 1.0)
    const completeness =
      (features?.profileCompleteness ??
        (typeof candidate.completionStatus === 'object' && candidate.completionStatus !== null
          ? ((candidate.completionStatus as { percentage?: number }).percentage ?? 50)
          : 50)) / 100;
    const photosScore = Math.min(1.0, (features?.photosCount ?? 1) / 3);
    const promptsScore = Math.min(1.0, (features?.promptsCount ?? 1) / 2);
    const profileQuality = Number(
      (completeness * 0.5 + photosScore * 0.3 + promptsScore * 0.2).toFixed(4)
    );

    // 6. Reciprocal Signal (0.0 to 1.0)
    let reciprocalSignal = 0.5;
    if (features) {
      const matchComponent = Math.min(1.0, features.matchRate * 2);
      const replyComponent = features.replyRate;
      reciprocalSignal = Number((matchComponent * 0.4 + replyComponent * 0.6).toFixed(4));
    }

    // 7. Exploration Boost (Deterministic pseudo-random jitter: 0.0 to config.explorationRate)
    const dateBucket = referenceTime.toISOString().slice(0, 10);
    const hashInput = `${context.viewerUserId}:${candidate.userId}:${dateBucket}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
    const hashInt = parseInt(hash.slice(0, 6), 16);
    const normalizedJitter = (hashInt % 1000) / 1000;
    const explorationBoost = Number(
      (normalizedJitter * (config.explorationRate ?? 0.05)).toFixed(4)
    );

    // 8. Exposure Penalty (0.0 to config.maxExposurePenalty)
    const penaltyPerCount = config.exposurePenaltyPerCount ?? 0.08;
    const maxPenalty = config.maxExposurePenalty ?? 0.4;
    const exposurePenalty = Number(
      Math.min(maxPenalty, recentExposuresCount * penaltyPerCount).toFixed(4)
    );

    return {
      preferenceCompatibility,
      sharedInterests,
      socialAffinity,
      activityFreshness,
      profileQuality,
      reciprocalSignal,
      explorationBoost,
      exposurePenalty,
    };
  }
}
