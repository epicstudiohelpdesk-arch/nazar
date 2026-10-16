import type {
  InterestItem,
  PublicMediaItem,
  PublicPromptItem,
  EventPlusOneInfo,
} from '@platform/api-contracts';
import type { CandidateRecord, DiscoveryViewerContext } from '../domain/discovery.types.js';

export interface HydratedProfileComponents {
  readonly interests: readonly InterestItem[];
  readonly prompts: readonly PublicPromptItem[];
  readonly media: readonly PublicMediaItem[];
  readonly eventPlusOne?: EventPlusOneInfo | null;
}

export interface ICandidateRepository {
  /**
   * Retrieves candidate profiles that strictly satisfy server-authoritative eligibility
   * (self-exclusion, active state, completeness, reciprocal age/gender preferences, and PostGIS distance).
   */
  findEligibleCandidates(
    context: DiscoveryViewerContext,
    excludedUserIds: readonly string[],
    candidatePoolLimit?: number
  ): Promise<readonly CandidateRecord[]>;

  /**
   * Batched hydration of public profile interests, prompts, and READY media.
   * Avoids N+1 query patterns.
   */
  batchHydrateComponents(
    profileIds: readonly string[]
  ): Promise<Map<string, HydratedProfileComponents>>;
}

export const CANDIDATE_REPOSITORY_TOKEN = Symbol('ICandidateRepository');
