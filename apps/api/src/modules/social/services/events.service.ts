import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ErrorCode,
  type EventDto,
  type EventListResponseDto,
  type EventRsvpDto,
  type EventAttendeeListResponseDto,
  type EventType,
  type EventStatus,
  type EventRsvpStatus,
} from '@platform/api-contracts';
import {
  EVENTS_REPOSITORY_TOKEN,
  type IEventsRepository,
} from '../repositories/events.repository.interface.js';
import {
  COMMUNITIES_REPOSITORY_TOKEN,
  type ICommunitiesRepository,
} from '../repositories/communities.repository.interface.js';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../../safety/repositories/user-blocks.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import { EntitlementService } from '../../payments/services/entitlement.service.js';
import { SocialProfileEnricherService } from './social-profile-enricher.service.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  CreateEventInput,
  UpdateEventInput,
  GetEventsQueryInput,
  CreateRsvpInput,
} from '@platform/validation';

export interface CursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw) as CursorPayload;
  } catch {
    return null;
  }
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENTS_REPOSITORY_TOKEN)
    private readonly eventsRepo: IEventsRepository,
    @Inject(COMMUNITIES_REPOSITORY_TOKEN)
    private readonly communitiesRepo: ICommunitiesRepository,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(SocialProfileEnricherService)
    private readonly profileEnricher: SocialProfileEnricherService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private async assertCanParticipate(userId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.ACCOUNT_BANNED,
        message: 'Your account has been suspended or banned',
      });
    }
  }

  async createEvent(organizerId: string, input: CreateEventInput): Promise<EventDto> {
    await this.assertCanParticipate(organizerId);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException({
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Event end time must be after start time',
      });
    }

    // Gate 11 Entitlement Check: Free events up to 50 attendees, larger requires PREMIUM
    if (input.capacity && input.capacity > 50) {
      await this.entitlementService.requireEntitlement(organizerId, 'PREMIUM');
    }

    let communityName: string | null = null;
    if (input.communityId) {
      const community = await this.communitiesRepo.findById(input.communityId);
      if (!community) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.COMMUNITY_NOT_FOUND,
          message: 'Community not found',
        });
      }
      communityName = community.name;
    }

    const eventId = generateUuidV7();
    const rsvpId = generateUuidV7();

    return this.databaseService.withTransaction(async (tx) => {
      const event = await this.eventsRepo.createEvent(
        {
          id: eventId,
          organizerId,
          communityId: input.communityId || null,
          title: input.title,
          description: input.description,
          type: input.type,
          status: 'PUBLISHED',
          startAt,
          endAt,
          locationName: input.locationName,
          locationAddress: input.locationAddress || null,
          locationUrl: input.locationUrl || null,
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          capacity: input.capacity || null,
          attendeeCount: 1, // Organizer automatically counted
          waitlistCount: 0,
          isWaitlistEnabled: input.isWaitlistEnabled !== false,
          coverMediaId: input.coverMediaId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Organizer RSVP
      await this.eventsRepo.createOrUpdateRsvp(
        {
          id: rsvpId,
          eventId: event.id,
          userId: organizerId,
          status: 'GOING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Outbox domain event
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'event.created',
        aggregateType: 'EVENT',
        aggregateId: event.id,
        payload: {
          eventId: event.id,
          organizerId,
          title: event.title,
          type: event.type,
          startAt: event.startAt.toISOString(),
          createdAt: event.createdAt.toISOString(),
        },
        status: 'PENDING',
      });

      const organizer = await this.profileEnricher.getAuthor(organizerId);

      return {
        id: event.id,
        organizerId: event.organizerId,
        organizer,
        communityId: event.communityId,
        communityName,
        title: event.title,
        description: event.description,
        coverUrl: null,
        type: event.type as EventType,
        status: event.status as EventStatus,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        locationName: event.locationName,
        locationAddress: event.locationAddress,
        locationUrl: event.locationUrl,
        latitude: event.latitude,
        longitude: event.longitude,
        capacity: event.capacity,
        attendeeCount: 1,
        waitlistCount: 0,
        isWaitlistEnabled: event.isWaitlistEnabled,
        currentUserRsvp: 'GOING',
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      };
    });
  }

  async getEvent(id: string, viewerUserId: string): Promise<EventDto> {
    const event = await this.eventsRepo.findById(id);
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      });
    }

    // Safety: Gate 09 block check
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(
      viewerUserId,
      event.organizerId
    );
    if (isBlocked) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      });
    }

    const [organizer, rsvp] = await Promise.all([
      this.profileEnricher.getAuthor(event.organizerId),
      this.eventsRepo.getRsvp(id, viewerUserId),
    ]);

    // Privacy-aware location:
    // Only confirmed attendees (GOING) and organizer can see exact address and meeting URL
    const isConfirmedAttendee = rsvp?.status === 'GOING';
    const isOrganizer = event.organizerId === viewerUserId;
    const canViewPrivateLocation = isConfirmedAttendee || isOrganizer;

    return {
      id: event.id,
      organizerId: event.organizerId,
      organizer,
      communityId: event.communityId,
      communityName: null,
      title: event.title,
      description: event.description,
      coverUrl: null,
      type: event.type as EventType,
      status: event.status as EventStatus,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      locationName: event.locationName,
      locationAddress: canViewPrivateLocation ? event.locationAddress : null,
      locationUrl: canViewPrivateLocation ? event.locationUrl : null,
      latitude: event.latitude,
      longitude: event.longitude,
      capacity: event.capacity,
      attendeeCount: event.attendeeCount,
      waitlistCount: event.waitlistCount,
      isWaitlistEnabled: event.isWaitlistEnabled,
      currentUserRsvp: (rsvp?.status as EventRsvpStatus) || null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  async updateEvent(id: string, organizerId: string, input: UpdateEventInput): Promise<EventDto> {
    const event = await this.eventsRepo.findById(id);
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      });
    }

    if (event.organizerId !== organizerId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.EVENT_ACCESS_DENIED,
        message: 'Only the organizer can edit this event',
      });
    }

    const updated = await this.eventsRepo.updateEvent(id, {
      title: input.title !== undefined ? input.title : event.title,
      description: input.description !== undefined ? input.description : event.description,
      type: input.type !== undefined ? input.type : event.type,
      status: input.status !== undefined ? input.status : event.status,
      startAt: input.startAt ? new Date(input.startAt) : event.startAt,
      endAt: input.endAt ? new Date(input.endAt) : event.endAt,
      locationName: input.locationName !== undefined ? input.locationName : event.locationName,
      locationAddress:
        input.locationAddress !== undefined ? input.locationAddress : event.locationAddress,
      locationUrl: input.locationUrl !== undefined ? input.locationUrl : event.locationUrl,
      latitude: input.latitude !== undefined ? input.latitude : event.latitude,
      longitude: input.longitude !== undefined ? input.longitude : event.longitude,
      capacity: input.capacity !== undefined ? input.capacity : event.capacity,
      isWaitlistEnabled:
        input.isWaitlistEnabled !== undefined ? input.isWaitlistEnabled : event.isWaitlistEnabled,
    });

    const organizer = await this.profileEnricher.getAuthor(organizerId);

    return {
      id: updated!.id,
      organizerId: updated!.organizerId,
      organizer,
      communityId: updated!.communityId,
      communityName: null,
      title: updated!.title,
      description: updated!.description,
      coverUrl: null,
      type: updated!.type as EventType,
      status: updated!.status as EventStatus,
      startAt: updated!.startAt.toISOString(),
      endAt: updated!.endAt.toISOString(),
      locationName: updated!.locationName,
      locationAddress: updated!.locationAddress,
      locationUrl: updated!.locationUrl,
      latitude: updated!.latitude,
      longitude: updated!.longitude,
      capacity: updated!.capacity,
      attendeeCount: updated!.attendeeCount,
      waitlistCount: updated!.waitlistCount,
      isWaitlistEnabled: updated!.isWaitlistEnabled,
      currentUserRsvp: 'GOING',
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  async cancelEvent(id: string, organizerId: string): Promise<{ success: boolean }> {
    const event = await this.eventsRepo.findById(id);
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      });
    }

    if (event.organizerId !== organizerId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.EVENT_ACCESS_DENIED,
        message: 'Only the organizer can cancel this event',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.eventsRepo.updateEvent(id, { status: 'CANCELLED' }, tx);
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'event.cancelled',
        aggregateType: 'EVENT',
        aggregateId: id,
        payload: {
          eventId: id,
          organizerId,
          cancelledAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });
    });

    return { success: true };
  }

  /**
   * Concurrency-safe RSVP management with row-level lock and deterministic FIFO waitlist promotion.
   */
  async rsvp(
    id: string,
    userId: string,
    input: CreateRsvpInput
  ): Promise<{ status: EventRsvpStatus }> {
    await this.assertCanParticipate(userId);

    return this.databaseService.withTransaction(async (tx) => {
      // 1. Lock event row for atomic capacity check
      const event = await this.eventsRepo.findByIdForUpdate(id, tx);
      if (!event) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Event not found',
        });
      }

      if (event.status !== 'PUBLISHED') {
        throw new BadRequestException({
          statusCode: 400,
          code: ErrorCode.EVENT_CANCELLED,
          message: 'Cannot RSVP to an inactive or cancelled event',
        });
      }

      // Safety check
      const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(
        userId,
        event.organizerId,
        tx
      );
      if (isBlocked) {
        throw new ForbiddenException({
          statusCode: 403,
          code: ErrorCode.USER_BLOCKED,
          message: 'Cannot RSVP to this event due to safety settings',
        });
      }

      const existingRsvp = await this.eventsRepo.getRsvp(id, userId, tx);
      let targetStatus: EventRsvpStatus;

      if (input.status === 'GOING') {
        if (existingRsvp?.status === 'GOING') {
          return { status: 'GOING' };
        }

        const isFull = event.capacity !== null && event.attendeeCount >= event.capacity;
        if (!isFull) {
          // Confirm GOING
          targetStatus = 'GOING';
          let waitlistDecrement = 0;
          if (existingRsvp?.status === 'WAITLISTED') {
            waitlistDecrement = 1;
          }

          await this.eventsRepo.updateEvent(
            id,
            {
              attendeeCount: event.attendeeCount + 1,
              waitlistCount: Math.max(0, event.waitlistCount - waitlistDecrement),
            },
            tx
          );

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'event.rsvp_confirmed',
            aggregateType: 'EVENT',
            aggregateId: id,
            payload: {
              eventId: id,
              userId,
              status: 'GOING',
              title: event.title,
            },
            status: 'PENDING',
          });
        } else {
          // Event is full
          if (event.isWaitlistEnabled) {
            targetStatus = 'WAITLISTED';
            if (existingRsvp?.status !== 'WAITLISTED') {
              await this.eventsRepo.updateEvent(id, { waitlistCount: event.waitlistCount + 1 }, tx);
            }

            await tx.insert(outboxEvents).values({
              id: generateUuidV7(),
              eventType: 'event.waitlisted',
              aggregateType: 'EVENT',
              aggregateId: id,
              payload: {
                eventId: id,
                userId,
                status: 'WAITLISTED',
                title: event.title,
              },
              status: 'PENDING',
            });
          } else {
            throw new BadRequestException({
              statusCode: 400,
              code: ErrorCode.EVENT_FULL,
              message: 'This event has reached full capacity and waitlist is closed',
            });
          }
        }
      } else {
        // INTERESTED
        targetStatus = 'INTERESTED';
        if (existingRsvp?.status === 'GOING') {
          // Leaving confirmed attendee spot
          let newAttendeeCount = event.attendeeCount - 1;
          let newWaitlistCount = event.waitlistCount;

          // FIFO waitlist promotion
          if (event.isWaitlistEnabled && event.waitlistCount > 0) {
            const nextWaitlisted = await this.eventsRepo.getOldestWaitlistedRsvpForUpdate(id, tx);
            if (nextWaitlisted) {
              await this.eventsRepo.createOrUpdateRsvp(
                {
                  id: nextWaitlisted.id,
                  eventId: id,
                  userId: nextWaitlisted.userId,
                  status: 'GOING',
                  promotedFromWaitlistAt: new Date(),
                  createdAt: nextWaitlisted.createdAt,
                  updatedAt: new Date(),
                },
                tx
              );

              newAttendeeCount += 1; // spot filled by promoted user
              newWaitlistCount = Math.max(0, newWaitlistCount - 1);

              await tx.insert(outboxEvents).values({
                id: generateUuidV7(),
                eventType: 'event.waitlist_promoted',
                aggregateType: 'EVENT',
                aggregateId: id,
                payload: {
                  eventId: id,
                  userId: nextWaitlisted.userId,
                  title: event.title,
                  promotedAt: new Date().toISOString(),
                },
                status: 'PENDING',
              });
            }
          }

          await this.eventsRepo.updateEvent(
            id,
            {
              attendeeCount: Math.max(0, newAttendeeCount),
              waitlistCount: newWaitlistCount,
            },
            tx
          );
        } else if (existingRsvp?.status === 'WAITLISTED') {
          await this.eventsRepo.updateEvent(
            id,
            { waitlistCount: Math.max(0, event.waitlistCount - 1) },
            tx
          );
        }
      }

      await this.eventsRepo.createOrUpdateRsvp(
        {
          id: existingRsvp?.id || generateUuidV7(),
          eventId: id,
          userId,
          status: targetStatus,
          createdAt: existingRsvp?.createdAt || new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      return { status: targetStatus };
    });
  }

  async cancelRsvp(id: string, userId: string): Promise<{ success: boolean }> {
    return this.databaseService.withTransaction(async (tx) => {
      const event = await this.eventsRepo.findByIdForUpdate(id, tx);
      if (!event) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Event not found',
        });
      }

      const existingRsvp = await this.eventsRepo.getRsvp(id, userId, tx);
      if (!existingRsvp) {
        throw new NotFoundException({
          statusCode: 404,
          code: ErrorCode.RSVP_NOT_FOUND,
          message: 'No RSVP found to cancel',
        });
      }

      if (existingRsvp.status === 'GOING') {
        let newAttendeeCount = event.attendeeCount - 1;
        let newWaitlistCount = event.waitlistCount;

        // FIFO Waitlist promotion!
        if (event.isWaitlistEnabled && event.waitlistCount > 0) {
          const nextWaitlisted = await this.eventsRepo.getOldestWaitlistedRsvpForUpdate(id, tx);
          if (nextWaitlisted) {
            await this.eventsRepo.createOrUpdateRsvp(
              {
                id: nextWaitlisted.id,
                eventId: id,
                userId: nextWaitlisted.userId,
                status: 'GOING',
                promotedFromWaitlistAt: new Date(),
                createdAt: nextWaitlisted.createdAt,
                updatedAt: new Date(),
              },
              tx
            );

            newAttendeeCount += 1;
            newWaitlistCount = Math.max(0, newWaitlistCount - 1);

            await tx.insert(outboxEvents).values({
              id: generateUuidV7(),
              eventType: 'event.waitlist_promoted',
              aggregateType: 'EVENT',
              aggregateId: id,
              payload: {
                eventId: id,
                userId: nextWaitlisted.userId,
                title: event.title,
                promotedAt: new Date().toISOString(),
              },
              status: 'PENDING',
            });
          }
        }

        await this.eventsRepo.updateEvent(
          id,
          {
            attendeeCount: Math.max(0, newAttendeeCount),
            waitlistCount: newWaitlistCount,
          },
          tx
        );
      } else if (existingRsvp.status === 'WAITLISTED') {
        await this.eventsRepo.updateEvent(
          id,
          { waitlistCount: Math.max(0, event.waitlistCount - 1) },
          tx
        );
      }

      await this.eventsRepo.deleteRsvp(id, userId, tx);
      return { success: true };
    });
  }

  async listAttendees(
    eventId: string,
    viewerUserId: string,
    query: { limit?: number; cursor?: string }
  ): Promise<EventAttendeeListResponseDto> {
    const event = await this.eventsRepo.findById(eventId);
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.EVENT_NOT_FOUND,
        message: 'Event not found',
      });
    }

    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const blockedUserIds = await this.userBlocksRepo.getAllBlockedUserIdsForUser(viewerUserId);

    const rows = await this.eventsRepo.listAttendees(eventId, {
      limit: limit + 1,
      cursor: parsedCursor,
      excludedUserIds: blockedUserIds,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const userIds = pageRows.map((r) => r.userId);
    const authorMap = await this.profileEnricher.getAuthorMap(userIds);

    const items: EventRsvpDto[] = pageRows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      userId: r.userId,
      user: authorMap.get(r.userId),
      status: r.status as EventRsvpStatus,
      promotedFromWaitlistAt: r.promotedFromWaitlistAt
        ? r.promotedFromWaitlistAt.toISOString()
        : null,
      createdAt: r.createdAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async discoverEvents(
    viewerUserId: string,
    query: GetEventsQueryInput
  ): Promise<EventListResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { startAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          startAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const blockedUserIds = await this.userBlocksRepo.getAllBlockedUserIdsForUser(viewerUserId);

    const rows = await this.eventsRepo.findDiscoverable({
      limit: limit + 1,
      cursor: parsedCursor,
      communityId: query.communityId,
      type: query.type,
      excludedOrganizerIds: blockedUserIds,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const organizerIds = pageRows.map((r) => r.organizerId);
    const organizerMap = await this.profileEnricher.getAuthorMap(organizerIds);

    const items: EventDto[] = pageRows.map((e) => {
      const isOrganizer = e.organizerId === viewerUserId;
      return {
        id: e.id,
        organizerId: e.organizerId,
        organizer: organizerMap.get(e.organizerId),
        communityId: e.communityId,
        communityName: null,
        title: e.title,
        description: e.description,
        coverUrl: null,
        type: e.type as EventType,
        status: e.status as EventStatus,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        locationName: e.locationName,
        locationAddress: isOrganizer ? e.locationAddress : null,
        locationUrl: isOrganizer ? e.locationUrl : null,
        latitude: e.latitude,
        longitude: e.longitude,
        capacity: e.capacity,
        attendeeCount: e.attendeeCount,
        waitlistCount: e.waitlistCount,
        isWaitlistEnabled: e.isWaitlistEnabled,
        currentUserRsvp: isOrganizer ? 'GOING' : null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.startAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
