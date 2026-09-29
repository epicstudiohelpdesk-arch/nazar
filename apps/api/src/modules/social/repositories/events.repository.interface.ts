import type {
  EventRow,
  NewEventRow,
  EventRsvpRow,
  NewEventRsvpRow,
} from '../../../infrastructure/database/drizzle/schema/events.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface EventCursor {
  readonly startAt: Date;
  readonly id: string;
}

export interface ListEventsOptions {
  readonly limit: number;
  readonly cursor?: EventCursor;
  readonly communityId?: string;
  readonly type?: string;
  readonly excludedOrganizerIds?: readonly string[];
}

export interface AttendeeCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface ListAttendeesOptions {
  readonly limit: number;
  readonly cursor?: AttendeeCursor;
  readonly excludedUserIds?: readonly string[];
}

export interface IEventsRepository {
  createEvent(data: NewEventRow, tx?: DrizzleDatabase): Promise<EventRow>;
  findById(id: string, tx?: DrizzleDatabase): Promise<EventRow | null>;
  findByIdForUpdate(id: string, tx: DrizzleDatabase): Promise<EventRow | null>;
  updateEvent(
    id: string,
    data: Partial<NewEventRow>,
    tx?: DrizzleDatabase
  ): Promise<EventRow | null>;
  findDiscoverable(options: ListEventsOptions, tx?: DrizzleDatabase): Promise<readonly EventRow[]>;

  // RSVPs
  getRsvp(eventId: string, userId: string, tx?: DrizzleDatabase): Promise<EventRsvpRow | null>;
  createOrUpdateRsvp(data: NewEventRsvpRow, tx?: DrizzleDatabase): Promise<EventRsvpRow>;
  deleteRsvp(eventId: string, userId: string, tx?: DrizzleDatabase): Promise<EventRsvpRow | null>;
  listAttendees(
    eventId: string,
    options: ListAttendeesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly EventRsvpRow[]>;
  getOldestWaitlistedRsvpForUpdate(
    eventId: string,
    tx: DrizzleDatabase
  ): Promise<EventRsvpRow | null>;
}

export const EVENTS_REPOSITORY_TOKEN = Symbol('IEventsRepository');
