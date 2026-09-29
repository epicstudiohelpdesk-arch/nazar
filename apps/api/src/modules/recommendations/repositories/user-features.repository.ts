import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  userRecommendationFeatures,
  type UserRecommendationFeaturesRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import type { UserFeatureVector } from '@platform/api-contracts';
import type { IUserFeaturesRepository } from './user-features.repository.interface.js';

@Injectable()
export class UserFeaturesRepository implements IUserFeaturesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findByUserId(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<UserRecommendationFeaturesRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(userRecommendationFeatures)
      .where(eq(userRecommendationFeatures.userId, userId))
      .limit(1);

    return row || null;
  }

  async findManyByUserIds(
    userIds: readonly string[],
    tx?: DrizzleDatabase
  ): Promise<readonly UserRecommendationFeaturesRow[]> {
    if (userIds.length === 0) return [];
    const client = this.getClient(tx);

    return client
      .select()
      .from(userRecommendationFeatures)
      .where(inArray(userRecommendationFeatures.userId, userIds as string[]));
  }

  async upsertFeatures(
    userId: string,
    featureVersion: string,
    features: UserFeatureVector,
    tx?: DrizzleDatabase
  ): Promise<UserRecommendationFeaturesRow> {
    const client = this.getClient(tx);
    const now = new Date();

    const [row] = await client
      .insert(userRecommendationFeatures)
      .values({
        userId,
        featureVersion,
        features,
        computedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userRecommendationFeatures.userId,
        set: {
          featureVersion,
          features,
          computedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return row!;
  }
}
