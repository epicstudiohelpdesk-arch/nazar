import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, gte, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  recommendationExposures,
  type RecommendationExposureRow,
  type NewRecommendationExposureRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import type { IExposuresRepository } from './exposures.repository.interface.js';

@Injectable()
export class ExposuresRepository implements IExposuresRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async recordExposure(
    data: NewRecommendationExposureRow,
    tx?: DrizzleDatabase
  ): Promise<RecommendationExposureRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(recommendationExposures).values(data).returning();
    return row!;
  }

  async recordBatchExposures(
    data: readonly NewRecommendationExposureRow[],
    tx?: DrizzleDatabase
  ): Promise<void> {
    if (data.length === 0) return;
    const client = this.getClient(tx);
    await client.insert(recommendationExposures).values(data as NewRecommendationExposureRow[]);
  }

  async getRecentCandidateExposures(
    viewerUserId: string,
    candidateUserIds: readonly string[],
    windowHours = 72,
    tx?: DrizzleDatabase
  ): Promise<Map<string, number>> {
    const countsMap = new Map<string, number>();
    if (candidateUserIds.length === 0) return countsMap;

    const client = this.getClient(tx);
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const rows = await client
      .select({
        candidateUserId: recommendationExposures.candidateUserId,
        exposureCount: sql<number>`count(*)::int`,
      })
      .from(recommendationExposures)
      .where(
        and(
          eq(recommendationExposures.viewerUserId, viewerUserId),
          inArray(recommendationExposures.candidateUserId, candidateUserIds as string[]),
          gte(recommendationExposures.surfacedAt, cutoff)
        )
      )
      .groupBy(recommendationExposures.candidateUserId);

    for (const r of rows) {
      countsMap.set(r.candidateUserId, r.exposureCount);
    }

    return countsMap;
  }

  async findRecentExposuresByViewer(
    viewerUserId: string,
    limit = 50,
    tx?: DrizzleDatabase
  ): Promise<readonly RecommendationExposureRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(recommendationExposures)
      .where(eq(recommendationExposures.viewerUserId, viewerUserId))
      .orderBy(sql`${recommendationExposures.surfacedAt} DESC`)
      .limit(limit);
  }
}
