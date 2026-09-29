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
  userBlocks,
  reports,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Safety: Concurrency & Race Conditions', () => {
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

  it('handles 10 concurrent block requests cleanly and idempotently without duplicate rows', async () => {
    const userA = await createActiveUser('conc_block_a');
    const userB = await createActiveUser('conc_block_b');

    // Fire 10 simultaneous block requests from A against B
    const promises = Array.from({ length: 10 }, (_, i) =>
      request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ reason: `Concurrent block request #${i}` })
    );

    const responses = await Promise.all(promises);

    // All should resolve with 200 OK and no 500 errors
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.blockedUserId).toBe(userB.userId);
    }

    // Verify exactly one row in user_blocks database table
    const blockRows = await databaseService.client
      .select()
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerUserId, userA.userId),
          eq(userBlocks.blockedUserId, userB.userId)
        )
      );

    expect(blockRows).toHaveLength(1);
  });

  it('handles 10 concurrent duplicate reports without creating duplicate records', async () => {
    const reporter = await createActiveUser('conc_rep_actor');
    const target = await createActiveUser('conc_rep_target');

    // Fire 10 simultaneous identical reports
    const promises = Array.from({ length: 10 }, () =>
      request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          targetType: 'USER',
          targetId: target.userId,
          reasonCode: 'SPAM',
          description: 'Spam activity',
        })
    );

    const responses = await Promise.all(promises);

    // Exactly one should succeed with 201 Created, the rest should be rejected with 409 REPORT_DUPLICATE
    const createdCount = responses.filter((r) => r.status === 201).length;
    const duplicateCount = responses.filter((r) => r.status === 409).length;

    expect(createdCount).toBe(1);
    expect(duplicateCount).toBe(9);

    // Verify exactly one report exists in DB
    const reportRows = await databaseService.client
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.reporterUserId, reporter.userId),
          eq(reports.targetId, target.userId),
          eq(reports.reasonCode, 'SPAM')
        )
      );

    expect(reportRows).toHaveLength(1);
  });

  it('maintains system consistency during simultaneous block and message sending', async () => {
    const userA = await createActiveUser('race_user_a');
    const userB = await createActiveUser('race_user_b');

    const matchId = generateUuidV7();
    const conversationId = generateUuidV7();
    const [u1, u2] = userA.userId < userB.userId ? [userA.userId, userB.userId] : [userB.userId, userA.userId];

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

    // Concurrently User A blocks User B while User B attempts to send a message
    const [blockRes, msgRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`),
      request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Race condition test message',
        }),
    ]);

    expect(blockRes.status).toBe(200);

    // In DB, match MUST be UNMATCHED and conversation MUST be CLOSED
    const matchRow = await databaseService.client
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    expect(matchRow[0]?.status).toBe('UNMATCHED');
    expect(matchRow[0]?.unmatchedReason).toBe('BLOCK');

    const convRow = await databaseService.client
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(convRow[0]?.status).toBe('CLOSED');
  });
});
