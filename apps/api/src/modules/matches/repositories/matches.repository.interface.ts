import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { MatchRow } from '../../../infrastructure/database/drizzle/schema/matches.js';

export interface FindMatchesOptions {
  readonly limit: number;
  readonly cursor?: {
    readonly matchedAt: Date;
    readonly id: string;
  };
}

export interface IMatchesRepository {
  createOrActivateMatchTx(
    tx: DrizzleDatabase,
    userAId: string,
    userBId: string
  ): Promise<{ match: MatchRow; wasCreated: boolean }>;

  findMatchById(matchId: string, tx?: DrizzleDatabase): Promise<MatchRow | null>;

  findMatchByUsers(
    userAId: string,
    userBId: string,
    tx?: DrizzleDatabase
  ): Promise<MatchRow | null>;

  findActiveMatchesForUser(
    userId: string,
    options: FindMatchesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly MatchRow[]>;

  unmatch(
    matchId: string,
    userId: string,
    reason?: string,
    tx?: DrizzleDatabase
  ): Promise<MatchRow | null>;
}

export const MATCHES_REPOSITORY_TOKEN = Symbol('IMatchesRepository');
