import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  recommendationExperimentAssignments,
  type RecommendationExperimentAssignmentRow,
  type NewRecommendationExperimentAssignmentRow,
} from '../../../infrastructure/database/drizzle/schema/recommendations.js';
import type { IExperimentsRepository } from './experiments.repository.interface.js';

@Injectable()
export class ExperimentsRepository implements IExperimentsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findAssignment(
    userId: string,
    experimentId: string,
    tx?: DrizzleDatabase
  ): Promise<RecommendationExperimentAssignmentRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(recommendationExperimentAssignments)
      .where(
        and(
          eq(recommendationExperimentAssignments.userId, userId),
          eq(recommendationExperimentAssignments.experimentId, experimentId)
        )
      )
      .limit(1);

    return row || null;
  }

  async createAssignment(
    data: NewRecommendationExperimentAssignmentRow,
    tx?: DrizzleDatabase
  ): Promise<RecommendationExperimentAssignmentRow> {
    const client = this.getClient(tx);
    const [row] = await client
      .insert(recommendationExperimentAssignments)
      .values(data)
      .onConflictDoNothing()
      .returning();

    if (!row) {
      const existing = await this.findAssignment(data.userId, data.experimentId, tx);
      return existing!;
    }

    return row;
  }
}
