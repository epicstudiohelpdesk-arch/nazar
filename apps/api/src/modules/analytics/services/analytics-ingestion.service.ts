import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  type AnalyticsClientEventItemDto,
  type IngestAnalyticsEventsDto,
  type IngestAnalyticsEventsResultDto,
} from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import { EventGovernanceService } from './event-governance.service.js';
import { AnalyticsEventsRepository } from '../repositories/analytics-events.repository.js';
import { type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';

@Injectable()
export class AnalyticsIngestionService {
  constructor(
    @Inject(EventGovernanceService)
    private readonly governance: EventGovernanceService,
    @Inject(AnalyticsEventsRepository)
    private readonly eventsRepo: AnalyticsEventsRepository
  ) {}

  /**
   * Ingests a validated batch of client analytics events.
   * Derives identity authoritatively from authenticated session to prevent impersonation.
   */
  async ingestClientEvents(
    dto: IngestAnalyticsEventsDto,
    authenticatedPrincipal?: AuthenticatedPrincipal | null,
    clientIp?: string,
    userAgent?: string
  ): Promise<IngestAnalyticsEventsResultDto> {
    if (!dto.events || dto.events.length === 0) {
      throw new BadRequestException('Events batch cannot be empty');
    }

    if (dto.events.length > 50) {
      throw new BadRequestException('Events batch cannot exceed 50 events');
    }

    let accepted = 0;
    let duplicates = 0;
    let quarantined = 0;
    const processedEventIds: string[] = [];

    for (const event of dto.events) {
      processedEventIds.push(event.eventId);

      // 1. Governance check
      const validation = this.governance.validateEvent(event, 'client');

      if (!validation.isValid) {
        // Quarantine invalid or unauthorized events
        await this.eventsRepo.insertQuarantine({
          id: generateUuidV7(),
          eventId: event.eventId,
          eventName: event.eventName,
          failureReason: validation.failureReason ?? 'VALIDATION_FAILED',
          rawPayload: event as unknown as Record<string, unknown>,
          source: 'client_api',
          errorDetails: validation.errorDetails ?? null,
          receivedAt: new Date(),
        });
        quarantined++;
        continue;
      }

      // 2. Identity binding: Derive user ID authoritatively from session
      const actorUserId = authenticatedPrincipal ? authenticatedPrincipal.userId : null;
      const sessionId = authenticatedPrincipal ? authenticatedPrincipal.sessionId : null;
      const deviceId = authenticatedPrincipal?.deviceId ?? event.deviceId ?? null;

      // 3. Build canonical event row
      const isNew = await this.eventsRepo.insertIdempotent({
        id: event.eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        occurredAt: new Date(event.occurredAt),
        receivedAt: new Date(),
        producer: 'client',
        actorUserId,
        anonymousId: event.anonymousId ?? null,
        sessionId,
        deviceId,
        platform: event.platform ?? null,
        appVersion: event.appVersion ?? null,
        locale: event.locale ?? null,
        requestId: null,
        privacyClass: validation.definition?.privacyClass ?? 'INTERNAL',
        properties: event.properties ?? {},
        context: {
          ...(event.context ?? {}),
          clientIp: clientIp ? 'masked' : null,
          userAgent: userAgent ?? null,
        },
        ingestionStatus: 'ACCEPTED',
      });

      if (isNew) {
        accepted++;
      } else {
        duplicates++;
      }
    }

    return {
      accepted,
      duplicates,
      quarantined,
      rejected: 0,
      processedEventIds,
    };
  }

  /**
   * Ingests a server-authoritative event directly into the analytics store.
   */
  async recordServerEvent(
    eventName: string,
    properties: Record<string, unknown>,
    options?: {
      actorUserId?: string | null;
      requestId?: string | null;
      occurredAt?: Date;
      context?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    const eventId = generateUuidV7();
    const eventItem: AnalyticsClientEventItemDto = {
      eventId,
      eventName,
      eventVersion: 1,
      occurredAt: (options?.occurredAt ?? new Date()).toISOString(),
      properties,
    };

    const validation = this.governance.validateEvent(eventItem, 'server');
    if (!validation.isValid) {
      await this.eventsRepo.insertQuarantine({
        id: generateUuidV7(),
        eventId,
        eventName,
        failureReason: validation.failureReason ?? 'SERVER_VALIDATION_FAILED',
        rawPayload: { eventName, properties, options },
        source: 'server_internal',
        errorDetails: validation.errorDetails ?? null,
        receivedAt: new Date(),
      });
      return false;
    }

    return this.eventsRepo.insertIdempotent({
      id: eventId,
      eventName,
      eventVersion: 1,
      occurredAt: options?.occurredAt ?? new Date(),
      receivedAt: new Date(),
      producer: 'server',
      actorUserId: options?.actorUserId ?? null,
      anonymousId: null,
      sessionId: null,
      deviceId: null,
      platform: 'backend',
      appVersion: null,
      locale: null,
      requestId: options?.requestId ?? null,
      privacyClass: validation.definition?.privacyClass ?? 'INTERNAL',
      properties,
      context: options?.context ?? null,
      ingestionStatus: 'ACCEPTED',
    });
  }
}
