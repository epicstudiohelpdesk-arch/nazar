import type {
  RecommendationExposureRow,
  NewRecommendationExposureRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';

export const EXPOSURES_REPOSITORY_TOKEN = Symbol('EXPOSURES_REPOSITORY_TOKEN');

export interface IExposuresRepository {
  recordExposure(data: NewRecommendationExposureRow): Promise<RecommendationExposureRow>;
  recordBatchExposures(data: readonly NewRecommendationExposureRow[]): Promise<void>;
  getRecentCandidateExposures(
    viewerUserId: string,
    candidateUserIds: readonly string[],
    windowHours?: number
  ): Promise<Map<string, number>>;
  findRecentExposuresByViewer(
    viewerUserId: string,
    limit?: number
  ): Promise<readonly RecommendationExposureRow[]>;
}
