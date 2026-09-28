import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, sql, lt } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import { matches, type MatchRow } from '../../../infrastructure/database/drizzle/schema/matches.js';
import { conversations } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  IMatchesRepository,
  FindMatchesOptions,
} from './matches.repository.interface.js';

@Injectable()
export class MatchesRepository implements IMatchesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createOrActivateMatchTx(
    tx: DrizzleDatabase,
    userAId: string,
    userBId: string
  ): Promise<{ match: MatchRow; wasCreated: boolean }> {
    // 1. Acquire transaction-scoped advisory lock on the normalized pair to serialize concurrent likes
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userAId}), hashtext(${userBId}))`
    );

    // 2. Check existing row with row-level lock
    const existing = await tx
      .select()
      .from(matches)
      .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)))
      .for('update');

    if (existing.length > 0 && existing[0]) {
      const current = existing[0];
      if (current.status === 'ACTIVE') {
        return { match: current, wasCreated: false };
      }

      // Re-activate previously unmatched match
      const [updated] = await tx
        .update(matches)
        .set({
          status: 'ACTIVE',
          matchedAt: new Date(),
          unmatchedByUserId: null,
          unmatchedAt: null,
          unmatchedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, current.id))
        .returning();

      if (!updated) {
        throw new Error('Failed to update match status');
      }

      await tx
        .insert(conversations)
        .values({
          id: generateUuidV7(),
          matchId: updated.id,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [conversations.matchId],
          set: {
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
        });

      return { match: updated, wasCreated: true };
    }

    // 2. Safe upsert with ON CONFLICT targeting (userAId, userBId)
    const matchId = generateUuidV7();
    const [inserted] = await tx
      .insert(matches)
      .values({
        id: matchId,
        userAId,
        userBId,
        status: 'ACTIVE',
        matchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [matches.userAId, matches.userBId],
        set: {
          status: 'ACTIVE',
          matchedAt: new Date(),
          unmatchedByUserId: null,
          unmatchedAt: null,
          unmatchedReason: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert match record');
    }

    await tx
      .insert(conversations)
      .values({
        id: generateUuidV7(),
        matchId: inserted.id,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [conversations.matchId],
        set: {
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

    return { match: inserted, wasCreated: true };
  }

  async findMatchById(matchId: string, tx?: DrizzleDatabase): Promise<MatchRow | null> {
    const client = this.getClient(tx);
    const rows = await client.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    return rows[0] || null;
  }

  async findMatchByUsers(
    userAId: string,
    userBId: string,
    tx?: DrizzleDatabase
  ): Promise<MatchRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(matches)
      .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)))
      .limit(1);
    return rows[0] || null;
  }

  async findActiveMatchesForUser(
    userId: string,
    options: FindMatchesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly MatchRow[]> {
    const client = this.getClient(tx);

    let conditions = and(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
      eq(matches.status, 'ACTIVE')
    );

    if (options.cursor) {
      const cursorCond = or(
        lt(matches.matchedAt, options.cursor.matchedAt),
        and(
          eq(matches.matchedAt, options.cursor.matchedAt),
          lt(matches.id, options.cursor.id)
        )
      );
      conditions = and(conditions, cursorCond);
    }

    return client
      .select()
      .from(matches)
      .where(conditions)
      .orderBy(sql`${matches.matchedAt} DESC, ${matches.id} DESC`)
      .limit(options.limit);
  }

  async unmatch(
    matchId: string,
    userId: string,
    reason?: string,
    tx?: DrizzleDatabase
  ): Promise<MatchRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .update(matches)
      .set({
        status: 'UNMATCHED',
        unmatchedByUserId: userId,
        unmatchedAt: new Date(),
        unmatchedReason: reason || 'USER_INITIATED',
        updatedAt: new Date(),
      })
      .where(eq(matches.id, matchId))
      .returning();

    return rows[0] || null;
  }
}
