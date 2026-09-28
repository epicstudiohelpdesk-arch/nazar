import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  userInteractions,
  type UserInteractionRow,
} from '../../../infrastructure/database/drizzle/schema/interactions.js';
import { generateUuidV7 } from '@platform/domain';
import type { IInteractionsRepository } from './interactions.repository.interface.js';

@Injectable()
export class InteractionsRepository implements IInteractionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async upsertInteraction(
    actorUserId: string,
    targetUserId: string,
    type: 'LIKE' | 'PASS',
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const [row] = await client
      .insert(userInteractions)
      .values({
        id,
        actorUserId,
        targetUserId,
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userInteractions.actorUserId, userInteractions.targetUserId],
        set: {
          type,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to upsert interaction record');
    }

    return row;
  }

  async findInteraction(
    actorUserId: string,
    targetUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.actorUserId, actorUserId),
          eq(userInteractions.targetUserId, targetUserId)
        )
      )
      .limit(1);

    return rows[0] || null;
  }

  async findRecentInteraction(
    actorUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.actorUserId, actorUserId))
      .orderBy(sql`${userInteractions.updatedAt} DESC`)
      .limit(1);

    return rows[0] || null;
  }

  async deleteInteraction(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .delete(userInteractions)
      .where(eq(userInteractions.id, id))
      .returning();

    return result.length > 0;
  }

  async findInteractionsByActor(
    actorUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly UserInteractionRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.actorUserId, actorUserId))
      .orderBy(sql`${userInteractions.createdAt} DESC`)
      .limit(limit);
  }
}
