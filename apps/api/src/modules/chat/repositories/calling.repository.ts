import { Injectable, Inject } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  callSessions,
  type CallSessionRow,
  type NewCallSessionRow,
} from '../../../infrastructure/database/drizzle/schema/call-sessions.js';
import { messages } from '../../../infrastructure/database/drizzle/schema/messages.js';
import type { CallStatus } from '@platform/api-contracts';

@Injectable()
export class CallingRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async createCallSession(row: NewCallSessionRow, tx?: DrizzleDatabase): Promise<CallSessionRow> {
    const client = this.getClient(tx);
    const [inserted] = await client.insert(callSessions).values(row).returning();
    if (!inserted) {
      throw new Error('Failed to create call session');
    }
    return inserted;
  }

  async findCallSessionById(id: string, tx?: DrizzleDatabase): Promise<CallSessionRow | null> {
    const client = this.getClient(tx);
    const rows = await client.select().from(callSessions).where(eq(callSessions.id, id)).limit(1);
    return rows[0] || null;
  }

  async updateCallStatus(
    id: string,
    status: CallStatus,
    endedAt?: Date,
    durationSeconds?: number,
    tx?: DrizzleDatabase
  ): Promise<CallSessionRow | null> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(callSessions)
      .set({
        status,
        ...(endedAt ? { endedAt } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      })
      .where(eq(callSessions.id, id))
      .returning();

    return updated || null;
  }

  async countUserMessages(
    conversationId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<number> {
    const client = this.getClient(tx);
    const [res] = await client
      .select({ val: count() })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.senderUserId, userId)));
    return Number(res?.val || 0);
  }
}
