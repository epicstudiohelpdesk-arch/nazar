import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { createTestApp } from '../test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../../src/infrastructure/database/database.service.js';
import {
  profiles,
  profilePreferences,
} from '../../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Post-Deployment Automated Smoke & Health Verification (Gate 18)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let wsUrl: string;

  let testUserA: { userId: string; accessToken: string };
  let testUserB: { userId: string; accessToken: string };
  let testMatchId: string;
  let testConversationId: string;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);

    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    wsUrl = `http://localhost:${address.port}/chat`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSmokeUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@nazar.app`;
    await request(app.getHttpServer())
      .post('/v1/auth/email/request-verification')
      .send({ email })
      .expect(200);

    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code })
      .expect(200);

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;

    await databaseService.client.insert(profiles).values({
      id: generateUuidV7(),
      userId,
      displayName: `${prefix} Smoke`,
      dateOfBirth: '1996-05-15',
      gender: 'WOMAN',
      city: 'London',
      countryCode: 'GB',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    await databaseService.client.insert(profilePreferences).values({
      id: generateUuidV7(),
      userId,
      minAge: 18,
      maxAge: 40,
      genderPreferences: ['MAN', 'WOMAN'],
      maxDistanceKm: 100,
      relationshipIntent: 'LONG_TERM',
    });

    return { userId, accessToken };
  }

  describe('1. Platform Health & Readiness Probes', () => {
    it('GET /health returns 200 with service metadata', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      const status = res.body.data?.status || res.body.status;
      expect(status).toBe('healthy');
    });

    it('GET /ready returns 200 when database and core indicators are ready', async () => {
      const res = await request(app.getHttpServer()).get('/ready').expect(200);
      const status = res.body.data?.status || res.body.status;
      expect(status).toBe('healthy');
    });

    it('GET /v1/health and GET /v1/ready return 200', async () => {
      await request(app.getHttpServer()).get('/v1/health').expect(200);
      await request(app.getHttpServer()).get('/v1/ready').expect(200);
    });

    it('verifies administrative endpoints are strictly protected (/v1/admin/system/health requires auth)', async () => {
      const res = await request(app.getHttpServer()).get('/v1/admin/system/health');
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('2. End-to-End User Lifecycle & Domain Verification', () => {
    it('creates active authenticated accounts (User A & User B)', async () => {
      testUserA = await createSmokeUser('smoke_a');
      testUserB = await createSmokeUser('smoke_b');

      expect(testUserA.accessToken).toBeDefined();
      expect(testUserB.accessToken).toBeDefined();
    });

    it('GET /v1/profiles/me reads authenticated profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(testUserA.userId);
    });

    it('GET /v1/discovery retrieves spatial candidate feed', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/discovery?limit=10')
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('executes reciprocal likes and forms a mutual match', async () => {
      // User A likes User B
      await request(app.getHttpServer())
        .post(`/v1/interactions/${testUserB.userId}/like`)
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .expect(200);

      // User B likes User A (Forms Match)
      const resMatch = await request(app.getHttpServer())
        .post(`/v1/interactions/${testUserA.userId}/like`)
        .set('Authorization', `Bearer ${testUserB.accessToken}`)
        .expect(200);

      expect(resMatch.body.data.matched).toBe(true);
      testMatchId = resMatch.body.data.matchId;
      expect(testMatchId).toBeDefined();
    });

    it('GET /v1/matches retrieves mutual matches list', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/matches')
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].id).toBe(testMatchId);
    });

    it('GET & POST /v1/conversations delivers messages', async () => {
      // Retrieve conversation for the match
      const convListRes = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .expect(200);

      expect(convListRes.body.success).toBe(true);
      expect(convListRes.body.data.items.length).toBeGreaterThan(0);
      testConversationId = convListRes.body.data.items[0].id;
      expect(testConversationId).toBeDefined();

      // Send message
      const sendRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Automated deployment smoke test verification message',
          messageType: 'TEXT',
        })
        .expect(201);

      expect(sendRes.body.success).toBe(true);

      // Read history
      const listRes = await request(app.getHttpServer())
        .get(`/v1/conversations/${testConversationId}/messages?limit=10`)
        .set('Authorization', `Bearer ${testUserB.accessToken}`)
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.items.length).toBeGreaterThan(0);
    });

    it('POST /v1/analytics/events ingests telemetry stream', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/analytics/events')
        .set('Authorization', `Bearer ${testUserA.accessToken}`)
        .send({
          events: [
            {
              eventId: generateUuidV7(),
              eventName: 'deployment.smoke.verified',
              occurredAt: new Date().toISOString(),
              properties: { testStage: 'smoke-verification' },
            },
          ],
        });

      expect([200, 202]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Realtime WebSocket Gateway Smoke Verification', () => {
    it('establishes authenticated WebSocket connection over /chat namespace', async () => {
      const socket: Socket = io(wsUrl, {
        auth: { token: testUserA.accessToken },
        transports: ['websocket'],
        forceNew: true,
      });

      const authData = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WS Auth Timeout')), 5000);
        socket.on('authenticated', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
        socket.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      socket.disconnect();
      expect(authData.userId).toBe(testUserA.userId);
    });
  });
});
