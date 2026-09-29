import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AnalyticsEventsRepository } from '../src/modules/analytics/repositories/analytics-events.repository.js';
import { generateUuidV7 } from '@platform/domain';

describe('Gate 15: Analytics Governance, Privacy & Security', () => {
  let app: INestApplication;
  let eventsRepo: AnalyticsEventsRepository;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    eventsRepo = app.get(AnalyticsEventsRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should quarantine unknown event names with UNKNOWN_EVENT reason', async () => {
    const eventId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId,
            eventName: 'unregistered.custom.action',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            properties: {},
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(0);
    expect(res.body.data.quarantined).toBe(1);

    const quarantined = await eventsRepo.findQuarantinedEvents(10, 0);
    const match = quarantined.find((q) => q.eventId === eventId);
    expect(match).toBeDefined();
    expect(match?.failureReason).toBe('UNKNOWN_EVENT');
  });

  it('should quarantine client attempts to claim server-authoritative events (CLIENT_PRODUCER_FORBIDDEN)', async () => {
    const eventId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId,
            eventName: 'subscription.started', // Server-only event
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            properties: {
              subscriptionId: generateUuidV7(),
              tier: 'PLUS',
              interval: 'MONTHLY',
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(0);
    expect(res.body.data.quarantined).toBe(1);

    const quarantined = await eventsRepo.findQuarantinedEvents(10, 0);
    const match = quarantined.find((q) => q.eventId === eventId);
    expect(match).toBeDefined();
    expect(match?.failureReason).toBe('CLIENT_PRODUCER_FORBIDDEN');
  });

  it('should quarantine events with mismatched schema versions (INVALID_VERSION)', async () => {
    const eventId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId,
            eventName: 'app.opened',
            eventVersion: 99, // Canonical version is 1
            occurredAt: new Date().toISOString(),
            properties: {},
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(0);
    expect(res.body.data.quarantined).toBe(1);

    const quarantined = await eventsRepo.findQuarantinedEvents(10, 0);
    const match = quarantined.find((q) => q.eventId === eventId);
    expect(match).toBeDefined();
    expect(match?.failureReason).toBe('INVALID_VERSION');
  });

  it('should quarantine events with future timestamp skew exceeding 5 minutes', async () => {
    const eventId = generateUuidV7();
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes in future

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId,
            eventName: 'app.opened',
            eventVersion: 1,
            occurredAt: futureDate,
            properties: {},
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(0);
    expect(res.body.data.quarantined).toBe(1);

    const quarantined = await eventsRepo.findQuarantinedEvents(10, 0);
    const match = quarantined.find((q) => q.eventId === eventId);
    expect(match).toBeDefined();
    expect(match?.failureReason).toBe('INVALID_TIMESTAMP_SKEW_FUTURE');
  });

  it('should quarantine events with missing required properties', async () => {
    const eventId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId,
            eventName: 'discovery.profile.exposed', // Requires targetUserId and rankPosition
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            properties: {}, // Missing targetUserId & rankPosition
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(0);
    expect(res.body.data.quarantined).toBe(1);

    const quarantined = await eventsRepo.findQuarantinedEvents(10, 0);
    const match = quarantined.find((q) => q.eventId === eventId);
    expect(match).toBeDefined();
    expect(match?.failureReason).toBe('MISSING_REQUIRED_PROPERTY');
  });

  it('should reject payloads containing prohibited sensitive fields (passwords, tokens, GPS coordinates)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId: generateUuidV7(),
            eventName: 'app.opened',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            properties: {
              latitude: 12.9716, // Prohibited exact GPS coords
              longitude: 77.5946,
            },
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
