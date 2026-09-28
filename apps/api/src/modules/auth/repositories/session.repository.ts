import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/drizzle/client.js';
import {
  sessions,
  sessionTokenHistory,
  devices,
  type SessionRow,
  type NewSessionRow,
  type SessionTokenHistoryRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';

export interface ActiveSessionWithDevice extends SessionRow {
  readonly platform?: string | null;
  readonly deviceModel?: string | null;
}

export interface ISessionRepository {
  createSession(data: NewSessionRow, db?: DrizzleDatabase): Promise<SessionRow>;
  findById(sessionId: string): Promise<SessionRow | null>;
  findByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  findInTokenHistory(tokenHash: string): Promise<SessionTokenHistoryRow | null>;
  rotateSessionToken(
    sessionId: string,
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: Date
  ): Promise<SessionRow>;
  revokeSession(sessionId: string, reason: string): Promise<SessionRow | null>;
  revokeAllUserSessions(userId: string, reason: string): Promise<number>;
  listActiveUserSessions(userId: string): Promise<ActiveSessionWithDevice[]>;
}

export const SESSION_REPOSITORY_TOKEN = Symbol('ISessionRepository');

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async createSession(data: NewSessionRow, db?: DrizzleDatabase): Promise<SessionRow> {
    const runner = db ?? this.databaseService.client;
    const [row] = await runner.insert(sessions).values(data).returning();

    if (!row) {
      throw new Error('Failed to create session record');
    }

    return row;
  }

  async findById(sessionId: string): Promise<SessionRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async findInTokenHistory(tokenHash: string): Promise<SessionTokenHistoryRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(sessionTokenHistory)
      .where(eq(sessionTokenHistory.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async rotateSessionToken(
    sessionId: string,
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: Date
  ): Promise<SessionRow> {
    return this.databaseService.withTransaction(async (tx) => {
      // 1. Archive old token hash into token history for replay detection
      await tx.insert(sessionTokenHistory).values({
        id: generateUuidV7(),
        sessionId,
        tokenHash: oldTokenHash,
      });

      // 2. Update session with new token hash and expiry
      const [updated] = await tx
        .update(sessions)
        .set({
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(sessions.id, sessionId))
        .returning();

      if (!updated) {
        throw new Error('Failed to rotate session refresh token');
      }

      return updated;
    });
  }

  async revokeSession(sessionId: string, reason: string): Promise<SessionRow | null> {
    const [updated] = await this.databaseService.client
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revocationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    return updated ?? null;
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<number> {
    const rows = await this.databaseService.client
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revocationReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning();

    return rows.length;
  }

  async listActiveUserSessions(userId: string): Promise<ActiveSessionWithDevice[]> {
    const rows = await this.databaseService.client
      .select({
        session: sessions,
        device: devices,
      })
      .from(sessions)
      .leftJoin(devices, eq(sessions.deviceId, devices.id))
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

    return rows.map((r) => ({
      ...r.session,
      platform: r.device?.platform ?? null,
      deviceModel: r.device?.deviceModel ?? null,
    }));
  }
}
