import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  recommendationModelVersions,
  type RecommendationModelVersionRow,
  type NewRecommendationModelVersionRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import type { IModelVersionsRepository } from './model-versions.repository.interface.js';

@Injectable()
export class ModelVersionsRepository implements IModelVersionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findActiveByMode(
    mode: string,
    tx?: DrizzleDatabase
  ): Promise<RecommendationModelVersionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(recommendationModelVersions)
      .where(
        and(
          eq(recommendationModelVersions.mode, mode),
          eq(recommendationModelVersions.isActive, true)
        )
      )
      .limit(1);

    return row || null;
  }

  async findByVersionAndMode(
    version: string,
    mode: string,
    tx?: DrizzleDatabase
  ): Promise<RecommendationModelVersionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(recommendationModelVersions)
      .where(
        and(
          eq(recommendationModelVersions.version, version),
          eq(recommendationModelVersions.mode, mode)
        )
      )
      .limit(1);

    return row || null;
  }

  async upsertModelVersion(
    data: NewRecommendationModelVersionRow,
    tx?: DrizzleDatabase
  ): Promise<RecommendationModelVersionRow> {
    const client = this.getClient(tx);
    const [row] = await client
      .insert(recommendationModelVersions)
      .values(data)
      .onConflictDoUpdate({
        target: [recommendationModelVersions.version, recommendationModelVersions.mode],
        set: {
          name: data.name,
          isActive: data.isActive,
          weights: data.weights,
          config: data.config,
          rolloutPercentage: data.rolloutPercentage,
          activatedAt: data.activatedAt || new Date(),
        },
      })
      .returning();

    return row!;
  }

  async findAll(tx?: DrizzleDatabase): Promise<readonly RecommendationModelVersionRow[]> {
    const client = this.getClient(tx);
    return client.select().from(recommendationModelVersions);
  }
}
