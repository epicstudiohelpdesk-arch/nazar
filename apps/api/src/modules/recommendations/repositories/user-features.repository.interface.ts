import type { UserRecommendationFeaturesRow } from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import type { UserFeatureVector } from '@platform/api-contracts';

export const USER_FEATURES_REPOSITORY_TOKEN = Symbol('USER_FEATURES_REPOSITORY_TOKEN');

export interface IUserFeaturesRepository {
  findByUserId(userId: string): Promise<UserRecommendationFeaturesRow | null>;
  findManyByUserIds(userIds: readonly string[]): Promise<readonly UserRecommendationFeaturesRow[]>;
  upsertFeatures(
    userId: string,
    featureVersion: string,
    features: UserFeatureVector
  ): Promise<UserRecommendationFeaturesRow>;
}
