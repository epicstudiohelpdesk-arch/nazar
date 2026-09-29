import { Injectable, Inject, Logger } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { recommendationExposures } from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import { FeatureExtractorService } from '../features/feature-extractor.service.js';
import {
  USER_FEATURES_REPOSITORY_TOKEN,
  type IUserFeaturesRepository,
} from '../repositories/user-features.repository.interface.js';
import type { UserRecommendationFeaturesRow } from '../../../infrastructure/database/drizzle/schema/recommendations.js';

@Injectable()
export class RecommendationFeatureWorker {
  private readonly logger = new Logger(RecommendationFeatureWorker.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(FeatureExtractorService)
    private readonly featureExtractor: FeatureExtractorService,
    @Inject(USER_FEATURES_REPOSITORY_TOKEN)
    private readonly userFeaturesRepo: IUserFeaturesRepository
  ) {}

  /**
   * Recalculate and store derived feature vector for a specific user.
   * Completely idempotent and retryable.
   */
  async recomputeFeaturesForUser(
    userId: string,
    featureVersion = 'v1'
  ): Promise<UserRecommendationFeaturesRow> {
    const features = await this.featureExtractor.extractFeatures(userId);
    const row = await this.userFeaturesRepo.upsertFeatures(userId, featureVersion, features);

    this.logger.log(
      `[RecommendationFeatureWorker] Successfully recomputed features for user ${userId} (version=${featureVersion})`
    );
    return row;
  }

  /**
   * Batch recalculation of feature vectors for a list of active users.
   */
  async recomputeFeaturesBatch(
    userIds: readonly string[],
    featureVersion = 'v1'
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (const userId of userIds) {
      try {
        await this.recomputeFeaturesForUser(userId, featureVersion);
        processed++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `[RecommendationFeatureWorker] Failed to compute features for user ${userId}: ${(err as Error)?.message}`
        );
      }
    }

    return { processed, errors };
  }

  /**
   * Data retention maintenance: purge exposures older than retention days (default 30 days).
   */
  async cleanupOldExposures(retentionDays = 30): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const client = this.databaseService.client;

    const result = await client
      .delete(recommendationExposures)
      .where(lt(recommendationExposures.surfacedAt, cutoff))
      .returning({ id: recommendationExposures.id });

    const deleted = result.length;
    this.logger.log(
      `[RecommendationFeatureWorker] Purged ${deleted} old recommendation exposure records older than ${cutoff.toISOString()}`
    );

    return { deleted };
  }
}
