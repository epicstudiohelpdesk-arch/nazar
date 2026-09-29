import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AnalyticsIngestionService } from '../src/modules/analytics/services/analytics-ingestion.service.js';
import { AnalyticsEventsRepository } from '../src/modules/analytics/repositories/analytics-events.repository.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { generateUuidV7 } from '@platform/domain';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';

describe('Gate 15: Analytics Ingestion Engine', () => {
  let app: INestApplication;
  let ingestionService: AnalyticsIngestionService;
  let eventsRepo: AnalyticsEventsRepository;
  let authService: AuthService;
  let mockEmailProvider: MockEmailProvider;

  let testUserToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    ingestionService = app.get(AnalyticsIngestionService);
    eventsRepo = app.get(AnalyticsEventsRepository);
    authService = app.get(AuthService);
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);

    // Create authenticated consumer user
    const email = `analytics-user-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    testUserId = verifyRes.body.data.user.id;
    testUserToken = verifyRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully ingest a valid batch of client events anonymously', async () => {
    const eventId1 = generateUuidV7();
    const eventId2 = generateUuidV7();
    const anonymousId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({
        events: [
          {
            eventId: eventId1,
            eventName: 'app.opened',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            anonymousId,
            platform: 'ios',
            appVersion: '1.0.0',
            properties: {},
          },
          {
            eventId: eventId2,
            eventName: 'discovery.profile.exposed',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            anonymousId,
            platform: 'ios',
            appVersion: '1.0.0',
            properties: {
              targetUserId: generateUuidV7(),
              rankPosition: 1,
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(2);
    expect(res.body.data.duplicates).toBe(0);
    expect(res.body.data.quarantined).toBe(0);

    const saved1 = await eventsRepo.findById(eventId1);
    expect(saved1).toBeDefined();
    expect(saved1?.eventName).toBe('app.opened');
    expect(saved1?.anonymousId).toBe(anonymousId);
    expect(saved1?.actorUserId).toBeNull();
  });

  it('should authoritatively bind actorUserId to authenticated consumer user', async () => {
    const eventId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        events: [
          {
            eventId,
            eventName: 'discovery.profile.exposed',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            platform: 'android',
            properties: {
              targetUserId: generateUuidV7(),
              rankPosition: 2,
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(1);

    const saved = await eventsRepo.findById(eventId);
    expect(saved).toBeDefined();
    expect(saved?.actorUserId).toBe(testUserId);
  });

  it('should handle duplicate events idempotently without double counting', async () => {
    const eventId = generateUuidV7();
    const eventPayload = {
      events: [
        {
          eventId,
          eventName: 'app.opened',
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          properties: {},
        },
      ],
    };

    // First ingestion: accepted = 1
    const res1 = await request(app.getHttpServer()).post('/v1/analytics/events').send(eventPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.accepted).toBe(1);
    expect(res1.body.data.duplicates).toBe(0);

    // Second ingestion with identical eventId: duplicates = 1, accepted = 0
    const res2 = await request(app.getHttpServer()).post('/v1/analytics/events').send(eventPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.accepted).toBe(0);
    expect(res2.body.data.duplicates).toBe(1);
  });

  it('should reject batches exceeding 50 events with 400 Bad Request', async () => {
    const events = [];
    for (let i = 0; i < 51; i++) {
      events.push({
        eventId: generateUuidV7(),
        eventName: 'app.opened',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        properties: {},
      });
    }

    const res = await request(app.getHttpServer()).post('/v1/analytics/events').send({ events });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject empty event batches with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/analytics/events')
      .send({ events: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should ingest server-authoritative events directly with producer server', async () => {
    const ok = await ingestionService.recordServerEvent(
      'match.created',
      {
        matchId: generateUuidV7(),
        userAId: generateUuidV7(),
        userBId: generateUuidV7(),
      },
      {
        actorUserId: testUserId,
        requestId: 'req-internal-test',
      }
    );

    expect(ok).toBe(true);
  });
});
