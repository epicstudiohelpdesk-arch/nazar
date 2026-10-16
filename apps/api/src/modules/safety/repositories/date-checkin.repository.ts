import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  dateCheckins,
  type DateCheckinRow,
  type NewDateCheckinRow,
} from '../../../infrastructure/database/drizzle/schema/date-checkins.js';

@Injectable()
export class DateCheckinRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async createCheckin(
    row: NewDateCheckinRow,
    tx?: DrizzleDatabase
  ): Promise<DateCheckinRow> {
    const client = this.getClient(tx);
    const [inserted] = await client.insert(dateCheckins).values(row).returning();
    if (!inserted) {
      throw new Error('Failed to create date check-in record');
    }
    return inserted;
  }

  async findCheckinById(
    id: string,
    tx?: DrizzleDatabase
  ): Promise<DateCheckinRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(dateCheckins)
      .where(eq(dateCheckins.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async findActiveCheckinForUser(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<DateCheckinRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(dateCheckins)
      .where(
        and(
          eq(dateCheckins.userId, userId),
          eq(dateCheckins.status, 'SCHEDULED')
        )
      )
      .orderBy(desc(dateCheckins.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  async confirmCheckin(
    id: string,
    checkedInAt: Date,
    tx?: DrizzleDatabase
  ): Promise<DateCheckinRow | null> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(dateCheckins)
      .set({
        status: 'CHECKED_IN',
        checkedInAt,
      })
      .where(eq(dateCheckins.id, id))
      .returning();
    return updated || null;
  }

  async triggerSos(
    id: string,
    sosTriggeredAt: Date,
    lat?: number | null,
    lng?: number | null,
    note?: string | null,
    tx?: DrizzleDatabase
  ): Promise<DateCheckinRow | null> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(dateCheckins)
      .set({
        status: 'SOS_TRIGGERED',
        sosTriggeredAt,
        sosLatitude: lat ?? null,
        sosLongitude: lng ?? null,
        sosNote: note ?? null,
      })
      .where(eq(dateCheckins.id, id))
      .returning();
    return updated || null;
  }
}
