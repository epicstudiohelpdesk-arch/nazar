import type {
  CandidateRecord,
  DiscoveryViewerContext,
  RankedCandidate,
} from '../domain/discovery.types.js';

export interface ICandidateRanker {
  /**
   * Evaluates and orders candidate profiles relative to the viewer's discovery context.
   */
  rank(
    candidates: readonly CandidateRecord[],
    context: DiscoveryViewerContext
  ): readonly RankedCandidate[];
}

export const CANDIDATE_RANKER_TOKEN = Symbol('ICandidateRanker');
