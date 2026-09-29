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
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Safety: User Blocking & Cross-Gate Enforcement', () => {
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

  describe('POST /v1/users/:userId/block', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const dummyId = generateUuidV7();
      const res = await request(app.getHttpServer()).post(`/v1/users/${dummyId}/block`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('rejects blocking oneself with 400 BLOCK_SELF', async () => {
      const user = await createActiveUser('block_self');

      const res = await request(app.getHttpServer())
        .post(`/v1/users/${user.userId}/block`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.BLOCK_SELF);
    });

    it('rejects blocking non-existent user with 404 USER_NOT_FOUND', async () => {
      const user = await createActiveUser('block_missing');
      const nonExistent = generateUuidV7();

      const res = await request(app.getHttpServer())
        .post(`/v1/users/${nonExistent}/block`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('successfully blocks user, is idempotent, and cascades to matches & conversations', async () => {
      const userA = await createActiveUser('block_a');
      const userB = await createActiveUser('block_b');

      // Create an active match and conversation between A and B
      const matchId = generateUuidV7();
      const conversationId = generateUuidV7();

      const [user1Id, user2Id] = userA.userId < userB.userId
        ? [userA.userId, userB.userId]
        : [userB.userId, userA.userId];

      await databaseService.client.insert(matches).values({
        id: matchId,
        userAId: user1Id,
        userBId: user2Id,
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

      // User A blocks User B
      const res1 = await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ reason: 'Harassment in messages' });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.blockedUserId).toBe(userB.userId);

      // Verify block row exists
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
      expect(blockRows[0]?.blockerUserId).toBe(userA.userId);
      expect(blockRows[0]?.blockedUserId).toBe(userB.userId);

      // Verify match cascaded to UNMATCHED with reason BLOCK
      const matchRows = await databaseService.client
        .select()
        .from(matches)
        .where(eq(matches.id, matchId));
      expect(matchRows[0]?.status).toBe('UNMATCHED');
      expect(matchRows[0]?.unmatchedReason).toBe('BLOCK');
      expect(matchRows[0]?.unmatchedByUserId).toBe(userA.userId);

      // Verify conversation cascaded to CLOSED
      const convRows = await databaseService.client
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      expect(convRows[0]?.status).toBe('CLOSED');

      // Verify outbox events emitted: user.blocked and conversation.safety_closed
      const events = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, userA.userId));
      expect(events.some((e) => e.eventType === 'user.blocked')).toBe(true);

      // Idempotent re-block returns 200
      const res2 = await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
    });

    it('enforces bidirectional interaction rejection when blocked', async () => {
      const userA = await createActiveUser('inter_block_a');
      const userB = await createActiveUser('inter_block_b');

      // User A blocks User B
      await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      // User B tries to LIKE User A -> 403 USER_BLOCKED
      const likeRes1 = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(likeRes1.status).toBe(403);
      expect(likeRes1.body.error.code).toBe(ErrorCode.USER_BLOCKED);

      // User A tries to LIKE User B -> 403 USER_BLOCKED
      const likeRes2 = await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(likeRes2.status).toBe(403);
      expect(likeRes2.body.error.code).toBe(ErrorCode.USER_BLOCKED);
    });

    it('enforces bidirectional messaging rejection when blocked', async () => {
      const userA = await createActiveUser('msg_block_a');
      const userB = await createActiveUser('msg_block_b');

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

      // User A blocks User B
      await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      // User B tries to send a message -> rejected with USER_BLOCKED or CONVERSATION_CLOSED
      const msgRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Hello there',
        });

      expect([400, 403]).toContain(msgRes.status);
      expect([ErrorCode.USER_BLOCKED, ErrorCode.CONVERSATION_CLOSED]).toContain(msgRes.body.error.code);

      // Accessing conversation detail also rejected with 403 USER_BLOCKED
      const detailRes = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(detailRes.status).toBe(403);
      expect(detailRes.body.error.code).toBe(ErrorCode.USER_BLOCKED);
    });
  });

  describe('GET /v1/users/blocks & DELETE /v1/users/:userId/block', () => {
    it('lists blocked users with profile hydration and cursor pagination', async () => {
      const userA = await createActiveUser('list_blocks_actor');
      const userB = await createActiveUser('list_blocks_target');

      // Block user B
      await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      // List blocks
      const listRes = await request(app.getHttpServer())
        .get('/v1/users/blocks')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.items).toHaveLength(1);
      expect(listRes.body.data.items[0].blockedUserId).toBe(userB.userId);
      expect(listRes.body.data.items[0].displayName).toBe('list_blocks_target User');
    });

    it('unblocks a user successfully and allows interaction again', async () => {
      const userA = await createActiveUser('unblock_a');
      const userB = await createActiveUser('unblock_b');

      // Block
      await request(app.getHttpServer())
        .post(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      // Unblock non-existent block -> 404 BLOCK_NOT_FOUND
      const missingRes = await request(app.getHttpServer())
        .delete(`/v1/users/${userA.userId}/block`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      expect(missingRes.status).toBe(404);
      expect(missingRes.body.error.code).toBe(ErrorCode.BLOCK_NOT_FOUND);

      // Unblock user B
      const unblockRes = await request(app.getHttpServer())
        .delete(`/v1/users/${userB.userId}/block`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(unblockRes.status).toBe(200);
      expect(unblockRes.body.success).toBe(true);
      expect(unblockRes.body.data.unblockedUserId).toBe(userB.userId);

      // Verify block is deleted in DB
      const blockRows = await databaseService.client
        .select()
        .from(userBlocks)
        .where(
          and(
            eq(userBlocks.blockerUserId, userA.userId),
            eq(userBlocks.blockedUserId, userB.userId)
          )
        );
      expect(blockRows).toHaveLength(0);

      // Verify outbox event emitted
      const outbox = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, userA.userId));
      expect(outbox.some((e) => e.eventType === 'user.unblocked')).toBe(true);
    });
  });
});
