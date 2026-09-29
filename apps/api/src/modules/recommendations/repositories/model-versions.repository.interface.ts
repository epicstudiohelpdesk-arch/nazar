import type {
  RecommendationModelVersionRow,
  NewRecommendationModelVersionRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';

export const MODEL_VERSIONS_REPOSITORY_TOKEN = Symbol('MODEL_VERSIONS_REPOSITORY_TOKEN');

export interface IModelVersionsRepository {
  findActiveByMode(mode: string): Promise<RecommendationModelVersionRow | null>;
  findByVersionAndMode(
    version: string,
    mode: string
  ): Promise<RecommendationModelVersionRow | null>;
  upsertModelVersion(
    data: NewRecommendationModelVersionRow
  ): Promise<RecommendationModelVersionRow>;
  findAll(): Promise<readonly RecommendationModelVersionRow[]>;
}
