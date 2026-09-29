import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, asc } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import {
  moderationCases,
  type ModerationCaseRow,
  type NewModerationCaseRow,
} from '../../../infrastructure/database/drizzle/schema/moderation-cases.js';
import {
  moderationCaseEvents,
  type ModerationCaseEventRow,
  type NewModerationCaseEventRow,
} from '../../../infrastructure/database/drizzle/schema/moderation-case-events.js';
import type { IModerationCasesRepository } from './moderation-cases.repository.interface.js';

@Injectable()
export class ModerationCasesRepository implements IModerationCasesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createCase(
    data: NewModerationCaseRow,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(moderationCases).values(data).returning();
    return row!;
  }

  async findOpenCaseBySubject(
    subjectUserId: string,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(moderationCases)
      .where(
        and(
          eq(moderationCases.subjectUserId, subjectUserId),
          or(
            eq(moderationCases.status, 'OPEN'),
            eq(moderationCases.status, 'TRIAGED'),
            eq(moderationCases.status, 'UNDER_REVIEW'),
            eq(moderationCases.status, 'ACTION_REQUIRED')
          )
        )
      )
      .limit(1);

    return row || null;
  }

  async findCaseById(
    caseId: string,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, caseId))
      .limit(1);

    return row || null;
  }

  async updateCase(
    caseId: string,
    data: Partial<Omit<ModerationCaseRow, 'id' | 'openedAt'>>,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(moderationCases)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(moderationCases.id, caseId))
      .returning();

    return row || null;
  }

  async createCaseEvent(
    data: NewModerationCaseEventRow,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseEventRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(moderationCaseEvents).values(data).returning();
    return row!;
  }

  async findCaseEvents(
    caseId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly ModerationCaseEventRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(moderationCaseEvents)
      .where(eq(moderationCaseEvents.caseId, caseId))
      .orderBy(asc(moderationCaseEvents.createdAt));
  }
}
