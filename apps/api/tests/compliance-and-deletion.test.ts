import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/index.js';
import { MockSmsProvider, SMS_PROVIDER_TOKEN } from '../src/modules/auth/providers/sms.provider.js';

describe('Gate 19: Store Compliance, App Links & Account Deletion', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let mockSmsProvider: MockSmsProvider;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    mockSmsProvider = app.get<MockSmsProvider>(SMS_PROVIDER_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  const getPhone = () => `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;

  async function createAuthenticatedUser(): Promise<{
    userId: string;
    accessToken: string;
    sessionId: string;
  }> {
    const phoneNumber = getPhone();
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });
    const code = mockSmsProvider.getLastOtp(phoneNumber)!;

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code });

    return {
      userId: verifyRes.body.data.user.id,
      accessToken: verifyRes.body.data.accessToken,
      sessionId: verifyRes.body.data.sessionId,
    };
  }

  describe('1. Digital Asset Links & Universal Links (.well-known)', () => {
    it('serves Android Digital Asset Links manifest at /.well-known/assetlinks.json', async () => {
      const res = await request(app.getHttpServer()).get('/.well-known/assetlinks.json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].relation).toContain('delegate_permission/common.handle_all_urls');
      expect(res.body[0].target.package_name).toBe('com.nazar.app');
      expect(res.body[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    });

    it('serves Apple App Site Association manifest at /.well-known/apple-app-site-association', async () => {
      const res = await request(app.getHttpServer()).get('/.well-known/apple-app-site-association');

      expect(res.status).toBe(200);
      expect(res.body.applinks).toBeDefined();
      expect(res.body.applinks.details[0].appID).toBe('TEAMID1234.com.nazar.app');
      expect(res.body.applinks.details[0].paths).toContain('/chat/*');
      expect(res.body.applinks.details[0].paths).toContain('/matches/*');
      expect(res.body.applinks.details[0].paths).toContain('/discovery');
    });
  });

  describe('2. Public Legal & Compliance Documents', () => {
    it('serves Privacy Policy at /v1/compliance/privacy', async () => {
      const res = await request(app.getHttpServer()).get('/v1/compliance/privacy');

      expect(res.status).toBe(200);
      expect(res.body.data.document).toBe('Nazar Privacy Policy');
      expect(res.body.data.dataCollection).toBeDefined();
      expect(res.body.data.deletionInstructions).toBeDefined();
    });

    it('serves Terms of Service at /v1/compliance/terms', async () => {
      const res = await request(app.getHttpServer()).get('/v1/compliance/terms');

      expect(res.status).toBe(200);
      expect(res.body.data.document).toBe('Nazar Terms of Service');
      expect(res.body.data.ageRequirement).toContain('18');
    });

    it('serves Account Deletion Instructions at /v1/compliance/delete-account', async () => {
      const res = await request(app.getHttpServer()).get('/v1/compliance/delete-account');

      expect(res.status).toBe(200);
      expect(res.body.data.inAppInstructions).toBeDefined();
      expect(res.body.data.webUrl).toBe('https://nazar.app/legal/delete-account');
    });
  });

  describe('3. Account Deletion Workflow (Store Compliance)', () => {
    it('requires authentication to request account deletion', async () => {
      const res = await request(app.getHttpServer()).delete('/v1/auth/account');
      expect(res.status).toBe(401);
    });

    it('executes account deletion, revokes sessions, and prevents future authentication', async () => {
      const { userId, accessToken } = await createAuthenticatedUser();

      // 1. Verify user is initially ACTIVE
      const [initialUser] = await databaseService.client
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      expect(initialUser?.status).toBe('ACTIVE');

      // 2. Perform Account Deletion request
      const deleteRes = await request(app.getHttpServer())
        .delete('/v1/auth/account')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data.message).toContain(
        'Account successfully scheduled for permanent deletion'
      );

      // 3. Verify user status is now DELETED in database
      const [deletedUser] = await databaseService.client
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      expect(deletedUser?.status).toBe('DELETED');
      expect(deletedUser?.deletedAt).not.toBeNull();

      // 4. Verify immediate request with the revoked access token is rejected
      const protectedRes = await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(protectedRes.status).toBe(401);

      // 5. Subsequent deletion call on already deleted account returns 404
      const secondDeleteRes = await request(app.getHttpServer())
        .delete('/v1/auth/account')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(secondDeleteRes.status).toBe(401);
    });
  });
});
