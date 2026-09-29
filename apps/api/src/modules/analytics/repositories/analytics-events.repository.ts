import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  analyticsEvents,
  analyticsEventQuarantine,
  type NewAnalyticsEventRow,
  type AnalyticsEventRow,
  type NewAnalyticsEventQuarantineRow,
  type AnalyticsEventQuarantineRow,
} from '../../../infrastructure/database/drizzle/schema/analytics.js';

export interface EventQueryOptions {
  readonly eventName?: string;
  readonly actorUserId?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AnalyticsEventsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  /**
   * Persists an analytics event idempotently.
   * Returns true if newly inserted, false if duplicate skipped.
   */
  async insertIdempotent(row: NewAnalyticsEventRow): Promise<boolean> {
    const result = await this.db.client
      .insert(analyticsEvents)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: analyticsEvents.id });

    return result.length > 0;
  }

  /**
   * Persists a quarantined event with failure context.
   */
  async insertQuarantine(row: NewAnalyticsEventQuarantineRow): Promise<void> {
    await this.db.client.insert(analyticsEventQuarantine).values(row);
  }

  /**
   * Finds event by ID.
   */
  async findById(id: string): Promise<AnalyticsEventRow | null> {
    const rows = await this.db.client
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Queries events with filtering and pagination.
   */
  async findEvents(options: EventQueryOptions): Promise<AnalyticsEventRow[]> {
    const conditions = [];

    if (options.eventName) {
      conditions.push(eq(analyticsEvents.eventName, options.eventName));
    }
    if (options.actorUserId) {
      conditions.push(eq(analyticsEvents.actorUserId, options.actorUserId));
    }
    if (options.startDate) {
      conditions.push(gte(analyticsEvents.occurredAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(analyticsEvents.occurredAt, options.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db.client
      .select()
      .from(analyticsEvents)
      .where(whereClause)
      .orderBy(desc(analyticsEvents.occurredAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);
  }

  /**
   * Queries quarantined events with pagination.
   */
  async findQuarantinedEvents(limit = 50, offset = 0): Promise<AnalyticsEventQuarantineRow[]> {
    return this.db.client
      .select()
      .from(analyticsEventQuarantine)
      .orderBy(desc(analyticsEventQuarantine.receivedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Fetches pipeline counts.
   */
  async getPipelineCounts(): Promise<{ totalAccepted: number; totalQuarantined: number }> {
    const [eventsRes, quarantineRes] = await Promise.all([
      this.db.client.select({ count: sql<number>`count(*)::int` }).from(analyticsEvents),
      this.db.client.select({ count: sql<number>`count(*)::int` }).from(analyticsEventQuarantine),
    ]);

    return {
      totalAccepted: eventsRes[0]?.count ?? 0,
      totalQuarantined: quarantineRes[0]?.count ?? 0,
    };
  }
}
