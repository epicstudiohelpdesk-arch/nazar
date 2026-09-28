import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import type { ICandidateExclusionProvider } from '../../discovery/exclusions/candidate-exclusion.interface.js';

/**
 * InteractionExclusionService (Gate 07 Discovery Integration)
 * Queries all candidates the requesting user has already interacted with (LIKED or PASSED)
 * or is actively MATCHED with, so the Discovery Engine can exclude them.
 */
@Injectable()
export class InteractionExclusionService implements ICandidateExclusionProvider {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getExcludedUserIds(viewerUserId: string): Promise<readonly string[]> {
    const client = this.databaseService.client;

    const result = await client.execute(sql<{ userId: string }>`
      SELECT target_user_id AS "userId"
      FROM user_interactions
      WHERE actor_user_id = ${viewerUserId}

      UNION

      SELECT CASE WHEN user_a_id = ${viewerUserId} THEN user_b_id ELSE user_a_id END AS "userId"
      FROM matches
      WHERE (user_a_id = ${viewerUserId} OR user_b_id = ${viewerUserId})
    `);

    const rows = (result.rows || result) as unknown as Array<{ userId: string }>;
    return rows.map((r) => r.userId);
  }
}
