import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { MockSmsProvider, SMS_PROVIDER_TOKEN } from '../src/modules/auth/providers/sms.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  profilePreferences,
  conversations,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';

describe('GATE 20: Production Launch Smoke Tests', () => {
  let app: INestApplication;
  let mockSmsProvider: MockSmsProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockSmsProvider = app.get<MockSmsProvider>(SMS_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  const generatePhone = () => `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;

  async function registerAndSetupActiveUser(name: string, city = 'San Francisco') {
    const phoneNumber = generatePhone();
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });
    const code = mockSmsProvider.getLastOtp(phoneNumber)!;

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code });

    const userId = verifyRes.body.data.user.id;
    const accessToken = verifyRes.body.data.accessToken;
    const profileId = generateUuidV7();

    // Insert active completed profile & preferences
    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: name,
      dateOfBirth: '1995-06-15',
      gender: 'MAN',
      city,
      countryCode: 'US',
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
      maxAge: 45,
      genderPreferences: ['MAN', 'WOMAN'],
      maxDistanceKm: 100,
      relationshipIntent: 'LONG_TERM',
    });

    return { userId, accessToken, profileId, phoneNumber };
  }

  describe('1. Production Infrastructure & Readiness Endpoints', () => {
    it('GET /health returns 200 with service health info', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.service).toBe('nazar-api');
    });

    it('GET /ready returns 200 with database and process indicators', async () => {
      const res = await request(app.getHttpServer()).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.checks.database.status).toBe('healthy');
      expect(res.body.data.checks.process.status).toBe('healthy');
    });

    it('GET /v1/health and /v1/ready resolve correctly', async () => {
      const [hRes, rRes] = await Promise.all([
        request(app.getHttpServer()).get('/v1/health'),
        request(app.getHttpServer()).get('/v1/ready'),
      ]);
      expect(hRes.status).toBe(200);
      expect(rRes.status).toBe(200);
      expect(hRes.body.data.status).toBe('healthy');
      expect(rRes.body.data.status).toBe('healthy');
    });
  });

  describe('2. Store Compliance & Public Manifests', () => {
    it('serves Android Digital Asset Links at /.well-known/assetlinks.json', async () => {
      const res = await request(app.getHttpServer()).get('/.well-known/assetlinks.json');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].target.package_name).toBe('com.nazar.app');
    });

    it('serves Apple App Site Association at /.well-known/apple-app-site-association', async () => {
      const res = await request(app.getHttpServer()).get('/.well-known/apple-app-site-association');
      expect(res.status).toBe(200);
      expect(res.body.applinks.details[0].appID).toBe('TEAMID1234.com.nazar.app');
    });

    it('serves public account deletion instructions at /v1/compliance/delete-account', async () => {
      const res = await request(app.getHttpServer()).get('/v1/compliance/delete-account');
      expect(res.status).toBe(200);
      expect(res.body.data.webUrl).toBe('https://nazar.app/legal/delete-account');
    });
  });

  describe('3. Core Production Journey Smoke Test', () => {
    it('executes user signup, profile read, update, match, messaging, safety, and deletion', async () => {
      // 1. User A signup & profile
      const userA = await registerAndSetupActiveUser('SmokeUserA');

      // 2. User B signup & profile
      const userB = await registerAndSetupActiveUser('SmokeUserB');

      // 3. User A reads own profile
      const getProfileRes = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(getProfileRes.status).toBe(200);
      expect(getProfileRes.body.data.displayName).toBe('SmokeUserA');

      // 4. User A updates bio
      const updateProfileRes = await request(app.getHttpServer())
        .put('/v1/profiles/me')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          displayName: 'SmokeUserA',
          dateOfBirth: '1995-06-15',
          gender: 'MAN',
          city: 'San Francisco',
          countryCode: 'US',
          bio: 'Updated launch smoke bio',
        });
      expect(updateProfileRes.status).toBe(200);
      expect(updateProfileRes.body.data.bio).toBe('Updated launch smoke bio');

      // 5. Query Discovery Feed for User A
      const discoveryRes = await request(app.getHttpServer())
        .get('/v1/discovery')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(discoveryRes.status).toBe(200);
      expect(discoveryRes.body.success).toBe(true);

      // 6. User A likes User B (Unilateral)
      const likeResA = await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(likeResA.status).toBe(200);
      expect(likeResA.body.data.matched).toBe(false);

      // 7. User B likes User A (Reciprocal -> Match + Auto Conversation)
      const likeResB = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      expect(likeResB.status).toBe(200);
      expect(likeResB.body.data.matched).toBe(true);
      const matchId = likeResB.body.data.matchId;
      expect(matchId).toBeDefined();

      // 8. User A checks matches list
      const matchesRes = await request(app.getHttpServer())
        .get('/v1/matches')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(matchesRes.status).toBe(200);
      expect(matchesRes.body.data.items.some((m: any) => m.id === matchId)).toBe(true);

      // 9. Fetch conversation for the match
      const [conv] = await databaseService.client
        .select()
        .from(conversations)
        .where(eq(conversations.matchId, matchId))
        .limit(1);
      expect(conv).toBeDefined();
      const conversationId = conv.id;

      // 10. Send message from User A to User B in Conversation
      const clientMessageId = generateUuidV7();
      const sendMsgRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId,
          body: 'Hello from production launch smoke test!',
        });
      expect(sendMsgRes.status).toBe(201);
      expect(sendMsgRes.body.data.message.body).toBe('Hello from production launch smoke test!');
      expect(sendMsgRes.body.data.message.senderUserId).toBe(userA.userId);

      // 11. Safety: User B reports User A
      const reportRes = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: userA.userId,
          reasonCode: 'SPAM',
          details: 'Production launch safety smoke verification',
        });
      expect(reportRes.status).toBe(201);
      expect(reportRes.body.success).toBe(true);

      // 12. Safety: User B blocks User A
      const blockRes = await request(app.getHttpServer())
        .post(`/v1/users/${userA.userId}/block`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ reason: 'SPAM' });
      expect(blockRes.status).toBe(200);
      expect(blockRes.body.success).toBe(true);

      // 13. Account Deletion: User A deletes account
      const deleteRes = await request(app.getHttpServer())
        .delete('/v1/auth/account')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // 14. Verify User A access token is invalidated immediately
      const postDeleteAuthRes = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(postDeleteAuthRes.status).toBe(401);
    });
  });
});
