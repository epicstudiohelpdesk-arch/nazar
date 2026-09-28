import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { UserInteractionRow } from '../../../infrastructure/database/drizzle/schema/interactions.js';

export interface IInteractionsRepository {
  upsertInteraction(
    actorUserId: string,
    targetUserId: string,
    type: 'LIKE' | 'PASS',
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow>;

  findInteraction(
    actorUserId: string,
    targetUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null>;

  findRecentInteraction(
    actorUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null>;

  deleteInteraction(id: string, tx?: DrizzleDatabase): Promise<boolean>;

  findInteractionsByActor(
    actorUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly UserInteractionRow[]>;
}

export const INTERACTIONS_REPOSITORY_TOKEN = Symbol('IInteractionsRepository');
