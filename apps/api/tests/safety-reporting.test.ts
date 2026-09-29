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
  messages,
  reports,
  moderationCases,
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Safety: Reporting Engine & Moderation Cases', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
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

  describe('POST /v1/reports', () => {
    it('rejects unauthenticated reports with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer()).post('/v1/reports').send({
        targetType: 'USER',
        targetId: generateUuidV7(),
        reasonCode: 'HARASSMENT',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('rejects self-report with 400 SELF_REPORT_NOT_ALLOWED', async () => {
      const user = await createActiveUser('self_report');

      const res = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: user.userId,
          reasonCode: 'HARASSMENT',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.SELF_REPORT_NOT_ALLOWED);
    });

    it('rejects reporting non-existent target with 404 REPORT_TARGET_NOT_FOUND', async () => {
      const user = await createActiveUser('target_missing');
      const missingId = generateUuidV7();

      const res = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: missingId,
          reasonCode: 'SPAM',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.REPORT_TARGET_NOT_FOUND);
    });

    it('successfully reports a USER and automatically triages moderation case priority', async () => {
      const reporter = await createActiveUser('rep_user_actor');
      const target = await createActiveUser('rep_user_target');

      const res = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: target.userId,
          reasonCode: 'MINOR_SAFETY_CONCERN',
          description: 'User appears to be under 18',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.targetId).toBe(target.userId);
      expect(res.body.data.status).toBe('OPEN');

      // Verify report in DB has URGENT priority
      const reportRows = await databaseService.client
        .select()
        .from(reports)
        .where(eq(reports.id, res.body.data.id));
      expect(reportRows).toHaveLength(1);
      expect(reportRows[0]?.priority).toBe('URGENT');

      // Verify moderation case was created
      const caseRows = await databaseService.client
        .select()
        .from(moderationCases)
        .where(eq(moderationCases.subjectUserId, target.userId));
      expect(caseRows).toHaveLength(1);
      expect(caseRows[0]?.priority).toBe('URGENT');

      // Verify outbox event emitted
      const outbox = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, res.body.data.id));
      expect(outbox.some((e) => e.eventType === 'report.created')).toBe(true);
    });

    it('successfully reports a PROFILE', async () => {
      const reporter = await createActiveUser('rep_prof_actor');
      const target = await createActiveUser('rep_prof_target');

      const res = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'PROFILE',
          targetId: target.profileId,
          reasonCode: 'INAPPROPRIATE_CONTENT',
          description: 'Offensive profile bio',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe('PROFILE');
      expect(res.body.data.targetId).toBe(target.profileId);
    });

    it('verifies participant authorization when reporting a MESSAGE or CONVERSATION', async () => {
      const userA = await createActiveUser('msg_rep_a');
      const userB = await createActiveUser('msg_rep_b');
      const eavesdropper = await createActiveUser('msg_rep_eaves');

      const matchId = generateUuidV7();
      const conversationId = generateUuidV7();
      const messageId = generateUuidV7();

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

      await databaseService.client.insert(messages).values({
        id: messageId,
        conversationId,
        senderUserId: userB.userId,
        clientMessageId: generateUuidV7(),
        messageType: 'TEXT',
        body: 'Inappropriate message content',
        createdAt: new Date(),
      });

      // Eavesdropper tries to report message -> 403 SAFETY_ACCESS_DENIED
      const eavesRes = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${eavesdropper.accessToken}`)
        .send({
          targetType: 'MESSAGE',
          targetId: messageId,
          reasonCode: 'HARASSMENT',
        });

      expect(eavesRes.status).toBe(403);
      expect(eavesRes.body.error.code).toBe(ErrorCode.SAFETY_ACCESS_DENIED);

      // Sender tries to report their own message -> 400 SELF_REPORT_NOT_ALLOWED
      const ownRes = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          targetType: 'MESSAGE',
          targetId: messageId,
          reasonCode: 'HARASSMENT',
        });

      expect(ownRes.status).toBe(400);
      expect(ownRes.body.error.code).toBe(ErrorCode.SELF_REPORT_NOT_ALLOWED);

      // Recipient User A reports the message -> 201 Created
      const validRes = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          targetType: 'MESSAGE',
          targetId: messageId,
          reasonCode: 'HARASSMENT',
          description: 'Unwanted abusive message',
        });

      expect(validRes.status).toBe(201);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.data.targetId).toBe(messageId);
    });

    it('rejects duplicate reports with 409 REPORT_DUPLICATE', async () => {
      const reporter = await createActiveUser('dup_actor');
      const target = await createActiveUser('dup_target');

      // First report
      const res1 = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: target.userId,
          reasonCode: 'SPAM',
        });
      expect(res1.status).toBe(201);

      // Duplicate report with same reason against same target while open -> 409 REPORT_DUPLICATE
      const res2 = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: target.userId,
          reasonCode: 'SPAM',
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe(ErrorCode.REPORT_DUPLICATE);
    });
  });

  describe('GET /v1/reports/:id', () => {
    it('allows reporter to view report without leaking internal details or PII', async () => {
      const reporter = await createActiveUser('view_rep_actor');
      const target = await createActiveUser('view_rep_target');

      const createRes = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: target.userId,
          reasonCode: 'FAKE_PROFILE',
        });

      const reportId = createRes.body.data.id;

      // Reporter views report
      const getRes = await request(app.getHttpServer())
        .get(`/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${reporter.accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(reportId);
      expect(getRes.body.data.reporterUserId).toBe(reporter.userId);
      expect(getRes.body.data.status).toBe('OPEN');
      // Ensure no internal notes or admin fields are exposed
      expect(getRes.body.data.internalNotes).toBeUndefined();
      expect(getRes.body.data.moderationCaseId).toBeUndefined();

      // Another user attempts to view report -> 403 SAFETY_ACCESS_DENIED
      const otherUser = await createActiveUser('view_rep_other');
      const denyRes = await request(app.getHttpServer())
        .get(`/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`);

      expect(denyRes.status).toBe(403);
      expect(denyRes.body.error.code).toBe(ErrorCode.SAFETY_ACCESS_DENIED);
    });
  });
});
