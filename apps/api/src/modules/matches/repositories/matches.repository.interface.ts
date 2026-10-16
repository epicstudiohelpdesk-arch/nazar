import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { MatchRow } from '../../../infrastructure/database/drizzle/schema/matches.js';

import type { MatchStatus } from '@platform/api-contracts';

export interface FindMatchesOptions {
  readonly limit: number;
  readonly cursor?: {
    readonly matchedAt: Date;
    readonly id: string;
  };
}

export interface CreateMatchOptions {
  readonly status?: MatchStatus;
  readonly expiresAt?: Date | null;
}

export interface IMatchesRepository {
  createOrActivateMatchTx(
    tx: DrizzleDatabase,
    userAId: string,
    userBId: string,
    options?: CreateMatchOptions
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

  countActiveMatchesForUser(userId: string, tx?: DrizzleDatabase): Promise<number>;

  confirmMatchConversation(matchId: string, tx?: DrizzleDatabase): Promise<MatchRow | null>;

  unmatch(
    matchId: string,
    userId: string,
    reason?: string,
    tx?: DrizzleDatabase
  ): Promise<MatchRow | null>;
}

export const MATCHES_REPOSITORY_TOKEN = Symbol('IMatchesRepository');
