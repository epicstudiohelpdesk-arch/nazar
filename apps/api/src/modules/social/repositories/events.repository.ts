import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, asc, desc, isNull, notInArray, gt } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  events,
  type EventRow,
  type NewEventRow,
  eventRsvps,
  type EventRsvpRow,
  type NewEventRsvpRow,
} from '../../../infrastructure/database/drizzle/schema/events.js';
import type {
  IEventsRepository,
  ListEventsOptions,
  ListAttendeesOptions,
} from './events.repository.interface.js';

@Injectable()
export class EventsRepository implements IEventsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createEvent(data: NewEventRow, tx?: DrizzleDatabase): Promise<EventRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(events).values(data).returning();
    return row!;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<EventRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(events)
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .limit(1);
    return row || null;
  }

  async findByIdForUpdate(id: string, tx: DrizzleDatabase): Promise<EventRow | null> {
    const rows = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .for('update')
      .limit(1);
    return rows[0] || null;
  }

  async updateEvent(
    id: string,
    data: Partial<NewEventRow>,
    tx?: DrizzleDatabase
  ): Promise<EventRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .returning();
    return row || null;
  }

  async findDiscoverable(
    options: ListEventsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly EventRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${events.startAt} > ${options.cursor.startAt} OR (${events.startAt} = ${options.cursor.startAt} AND ${events.id} > ${options.cursor.id}))`;
    }

    const conditions = [
      eq(events.status, 'PUBLISHED'),
      isNull(events.deletedAt),
      gt(events.endAt, new Date()), // only active/future events
      cursorCondition,
    ];

    if (options.communityId) {
      conditions.push(eq(events.communityId, options.communityId));
    }

    if (options.type) {
      conditions.push(eq(events.type, options.type));
    }

    if (options.excludedOrganizerIds && options.excludedOrganizerIds.length > 0) {
      conditions.push(notInArray(events.organizerId, [...options.excludedOrganizerIds]));
    }

    return client
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(asc(events.startAt), asc(events.id))
      .limit(options.limit);
  }

  async getRsvp(
    eventId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<EventRsvpRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
      .limit(1);
    return row || null;
  }

  async createOrUpdateRsvp(data: NewEventRsvpRow, tx?: DrizzleDatabase): Promise<EventRsvpRow> {
    const client = this.getClient(tx);
    const [row] = await client
      .insert(eventRsvps)
      .values(data)
      .onConflictDoUpdate({
        target: [eventRsvps.eventId, eventRsvps.userId],
        set: {
          status: data.status,
          promotedFromWaitlistAt: data.promotedFromWaitlistAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  async deleteRsvp(
    eventId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<EventRsvpRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .delete(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
      .returning();
    return row || null;
  }

  async listAttendees(
    eventId: string,
    options: ListAttendeesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly EventRsvpRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${eventRsvps.createdAt} < ${options.cursor.createdAt} OR (${eventRsvps.createdAt} = ${options.cursor.createdAt} AND ${eventRsvps.id} < ${options.cursor.id}))`;
    }

    const conditions = [
      eq(eventRsvps.eventId, eventId),
      eq(eventRsvps.status, 'GOING'),
      cursorCondition,
    ];

    if (options.excludedUserIds && options.excludedUserIds.length > 0) {
      conditions.push(notInArray(eventRsvps.userId, [...options.excludedUserIds]));
    }

    return client
      .select()
      .from(eventRsvps)
      .where(and(...conditions))
      .orderBy(desc(eventRsvps.createdAt), desc(eventRsvps.id))
      .limit(options.limit);
  }

  async getOldestWaitlistedRsvpForUpdate(
    eventId: string,
    tx: DrizzleDatabase
  ): Promise<EventRsvpRow | null> {
    const rows = await tx
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, 'WAITLISTED')))
      .orderBy(asc(eventRsvps.createdAt), asc(eventRsvps.id))
      .for('update')
      .limit(1);

    return rows[0] || null;
  }
}
