import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, gt, sql, desc } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  otpChallenges,
  type OtpChallengeRow,
  type NewOtpChallengeRow,
  type OtpIdentifierType,
} from '../../../infrastructure/database/drizzle/schema/index.js';

export interface IOtpChallengeRepository {
  createChallenge(data: NewOtpChallengeRow): Promise<OtpChallengeRow>;
  findLatest(
    identifier: string,
    identifierType: OtpIdentifierType
  ): Promise<OtpChallengeRow | null>;
  findLatestActive(
    identifier: string,
    identifierType: OtpIdentifierType
  ): Promise<OtpChallengeRow | null>;
  incrementAttempts(challengeId: string): Promise<number>;
  consumeChallenge(challengeId: string): Promise<boolean>;
  countRecentRequests(identifier: string, windowMs: number): Promise<number>;
  countRecentRequestsByIp(ipAddress: string, windowMs: number): Promise<number>;
}

export const OTP_CHALLENGE_REPOSITORY_TOKEN = Symbol('IOtpChallengeRepository');

@Injectable()
export class OtpChallengeRepository implements IOtpChallengeRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async createChallenge(data: NewOtpChallengeRow): Promise<OtpChallengeRow> {
    const [row] = await this.databaseService.client.insert(otpChallenges).values(data).returning();

    if (!row) {
      throw new Error('Failed to create OTP challenge record');
    }

    return row;
  }

  async findLatest(
    identifier: string,
    identifierType: OtpIdentifierType
  ): Promise<OtpChallengeRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.identifier, identifier),
          eq(otpChallenges.identifierType, identifierType)
        )
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async findLatestActive(
    identifier: string,
    identifierType: OtpIdentifierType
  ): Promise<OtpChallengeRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.identifier, identifier),
          eq(otpChallenges.identifierType, identifierType),
          isNull(otpChallenges.consumedAt),
          gt(otpChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async incrementAttempts(challengeId: string): Promise<number> {
    const [updated] = await this.databaseService.client
      .update(otpChallenges)
      .set({
        attemptCount: sql`${otpChallenges.attemptCount} + 1`,
      })
      .where(eq(otpChallenges.id, challengeId))
      .returning();

    return updated?.attemptCount ?? 0;
  }

  async consumeChallenge(challengeId: string): Promise<boolean> {
    const [updated] = await this.databaseService.client
      .update(otpChallenges)
      .set({
        consumedAt: new Date(),
      })
      .where(and(eq(otpChallenges.id, challengeId), isNull(otpChallenges.consumedAt)))
      .returning();

    return Boolean(updated);
  }

  async countRecentRequests(identifier: string, windowMs: number): Promise<number> {
    const threshold = new Date(Date.now() - windowMs);
    const rows = await this.databaseService.client
      .select({ count: sql<number>`count(*)::int` })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.identifier, identifier), gt(otpChallenges.createdAt, threshold)));

    return rows[0]?.count ?? 0;
  }

  async countRecentRequestsByIp(ipAddress: string, windowMs: number): Promise<number> {
    const threshold = new Date(Date.now() - windowMs);
    const rows = await this.databaseService.client
      .select({ count: sql<number>`count(*)::int` })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.ipAddress, ipAddress), gt(otpChallenges.createdAt, threshold)));

    return rows[0]?.count ?? 0;
  }
}
