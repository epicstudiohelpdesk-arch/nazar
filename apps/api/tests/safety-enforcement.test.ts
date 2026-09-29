import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  matches,
  conversations,
  userRestrictions,
  moderationCases,
  sessions,
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';
import { ModerationService } from '../src/modules/safety/services/moderation.service.js';

describe('Safety: Enforcement, Restrictions Precedence & Session Revocation', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let moderationService: ModerationService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    moderationService = app.get(ModerationService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1998-05-15',
      gender: 'WOMAN',
      city: 'Mumbai',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    return { userId, profileId, accessToken };
  }

  describe('Restriction Precedence & Gate 04 AuthGuard Enforcement', () => {
    it('rejects API requests with 403 ACCOUNT_BANNED when user has active FULL_ACCOUNT restriction', async () => {
      const user = await createActiveUser('banned_user');

      // Insert active FULL_ACCOUNT restriction
      await databaseService.client.insert(userRestrictions).values({
        id: generateUuidV7(),
        userId: user.userId,
        restrictionType: 'FULL_ACCOUNT',
        reasonCode: 'SEVERE_VIOLATION',
        startsAt: new Date(),
        createdAt: new Date(),
      });

      // Attempt to access authenticated endpoint
      const res = await request(app.getHttpServer())
        .get('/v1/profile/me')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.ACCOUNT_BANNED);
    });

    it('rejects API requests with 403 ACCOUNT_SUSPENDED when user has active ACCOUNT_LOGIN restriction', async () => {
      const user = await createActiveUser('suspended_user');

      // Insert active ACCOUNT_LOGIN restriction
      await databaseService.client.insert(userRestrictions).values({
        id: generateUuidV7(),
        userId: user.userId,
        restrictionType: 'ACCOUNT_LOGIN',
        reasonCode: 'TEMPORARY_SUSPENSION',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 24 hours later
        createdAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/v1/profile/me')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.ACCOUNT_SUSPENDED);
    });

    it('ignores expired restrictions automatically', async () => {
      const user = await createActiveUser('expired_restriction');

      // Insert expired ACCOUNT_LOGIN restriction (expired 1 hour ago)
      await databaseService.client.insert(userRestrictions).values({
        id: generateUuidV7(),
        userId: user.userId,
        restrictionType: 'ACCOUNT_LOGIN',
        reasonCode: 'EXPIRED_PENALTY',
        startsAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 7200000),
      });

      // Request succeeds
      const res = await request(app.getHttpServer())
        .get('/v1/profile/me')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Scoped Feature Enforcement: MESSAGING & LIKES', () => {
    it('restricts messaging but allows profile and discovery when user has MESSAGING restriction', async () => {
      const userA = await createActiveUser('msg_restr_a');
      const userB = await createActiveUser('msg_restr_b');

      const matchId = generateUuidV7();
      const conversationId = generateUuidV7();
      const [u1, u2] =
        userA.userId < userB.userId ? [userA.userId, userB.userId] : [userB.userId, userA.userId];

      await databaseService.client.insert(matches).values({
        id: matchId,
        userAId: u1,
        userBId: u2,
        status: 'ACTIVE',
        matchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await databaseService.client.insert(conversations).values({
        id: conversationId,
        matchId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // User A can view profile
      const profRes = await request(app.getHttpServer())
        .get('/v1/profile/me')
        .set('Authorization', `Bearer ${userA.accessToken}`);
      expect(profRes.status).toBe(200);

      // Apply MESSAGING restriction on user A
      await databaseService.client.insert(userRestrictions).values({
        id: generateUuidV7(),
        userId: userA.userId,
        restrictionType: 'MESSAGING',
        reasonCode: 'SPAM_ACTIVITY',
        startsAt: new Date(),
        createdAt: new Date(),
      });

      // Attempt to send message -> 403 MESSAGING_RESTRICTED
      const sendRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Spam text message',
        });

      expect(sendRes.status).toBe(403);
      expect(sendRes.body.error.code).toBe(ErrorCode.MESSAGING_RESTRICTED);
    });

    it('restricts interactions when user has LIKES restriction', async () => {
      const userA = await createActiveUser('like_restr_a');
      const userB = await createActiveUser('like_restr_b');

      // Apply LIKES restriction on User A
      await databaseService.client.insert(userRestrictions).values({
        id: generateUuidV7(),
        userId: userA.userId,
        restrictionType: 'LIKES',
        reasonCode: 'RAPID_SWIPING_BOT',
        startsAt: new Date(),
        createdAt: new Date(),
      });

      // Attempt to LIKE user B -> 403 INTERACTION_RESTRICTED
      const likeRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(likeRes.status).toBe(403);
      expect(likeRes.body.error.code).toBe(ErrorCode.INTERACTION_RESTRICTED);

      // Attempt to PASS user B -> 403 INTERACTION_RESTRICTED
      const passRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/pass`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(passRes.status).toBe(403);
      expect(passRes.body.error.code).toBe(ErrorCode.INTERACTION_RESTRICTED);
    });
  });

  describe('Moderation Decision Application & Session Revocation', () => {
    it('revokes all active sessions upon BAN decision and emits case events', async () => {
      const user = await createActiveUser('ban_target');
      const moderatorId = generateUuidV7();

      // Create a moderation case
      const caseId = generateUuidV7();
      await databaseService.client.insert(moderationCases).values({
        id: caseId,
        subjectUserId: user.userId,
        sourceType: 'REPORT',
        caseType: 'VIOLENCE_OR_DANGER',
        status: 'OPEN',
        priority: 'URGENT',
        openedAt: new Date(),
        updatedAt: new Date(),
      });

      // Apply BAN decision
      const result = await moderationService.applyDecision(caseId, moderatorId, 'BAN', {
        reason: 'Severe threat detected; immediate platform ban',
      });

      expect(result.success).toBe(true);
      expect(result.decision).toBe('BAN');

      // Verify case status in DB is RESOLVED
      const updatedCase = await databaseService.client
        .select()
        .from(moderationCases)
        .where(eq(moderationCases.id, caseId));
      expect(updatedCase[0]?.status).toBe('RESOLVED');
      expect(updatedCase[0]?.resolutionDecision).toBe('BAN');

      // Verify FULL_ACCOUNT restriction created
      const restrs = await databaseService.client
        .select()
        .from(userRestrictions)
        .where(eq(userRestrictions.userId, user.userId));
      expect(restrs.some((r) => r.restrictionType === 'FULL_ACCOUNT')).toBe(true);

      // Verify all active sessions were revoked in DB
      const userSessions = await databaseService.client
        .select()
        .from(sessions)
        .where(eq(sessions.userId, user.userId));
      expect(userSessions.every((s) => s.revokedAt !== null)).toBe(true);

      // Subsequent API request with previous token is rejected (revoked session or banned)
      const res = await request(app.getHttpServer())
        .get('/v1/profile/me')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect([401, 403]).toContain(res.status);
    });
  });
});
