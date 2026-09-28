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
  profilePreferences,
  conversations,
  messages,
  conversationReadStates,
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Chat Concurrency, Idempotency & Monotonic State (Gate 08)', () => {
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
      dateOfBirth: '1997-01-01',
      gender: 'MAN',
      city: 'Delhi',
      countryCode: 'IN',
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

    return { userId, profileId, accessToken };
  }

  async function createMatchedPair(prefixA: string, prefixB: string) {
    const userA = await createActiveUser(prefixA);
    const userB = await createActiveUser(prefixB);

    await request(app.getHttpServer())
      .post(`/v1/interactions/${userB.userId}/like`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);

    const resB = await request(app.getHttpServer())
      .post(`/v1/interactions/${userA.userId}/like`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);

    const matchId = resB.body.data.matchId as string;

    const [conv] = await databaseService.client
      .select()
      .from(conversations)
      .where(eq(conversations.matchId, matchId))
      .limit(1);

    return { userA, userB, matchId, conversationId: conv.id };
  }

  describe('Concurrent Message Idempotency (Same clientMessageId)', () => {
    it('handles 10 concurrent message sends with identical clientMessageId yielding exactly 1 DB row and 1 outbox event', async () => {
      const { userA, conversationId } = await createMatchedPair('idemp_a', 'idemp_b');
      const sharedClientMessageId = generateUuidV7();

      // Launch 10 simultaneous identical send requests
      const promises = Array.from({ length: 10 }).map(() =>
        request(app.getHttpServer())
          .post(`/v1/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({
            clientMessageId: sharedClientMessageId,
            body: 'Idempotent concurrent message body',
          })
      );

      const results = await Promise.all(promises);

      // All 10 requests must succeed (HTTP 201)
      for (const res of results) {
        expect(res.status).toBe(201);
        expect(res.body.data.message.clientMessageId).toBe(sharedClientMessageId);
        expect(res.body.data.message.body).toBe('Idempotent concurrent message body');
      }

      // Exactly 1 message row must exist in DB
      const insertedRows = await databaseService.client
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.clientMessageId, sharedClientMessageId)
          )
        );

      expect(insertedRows).toHaveLength(1);

      // Exactly 1 outbox event for this message must exist
      const messageId = insertedRows[0].id;
      const outbox = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.aggregateType, 'MESSAGE'),
            eq(outboxEvents.aggregateId, messageId)
          )
        );

      expect(outbox).toHaveLength(1);
    });
  });

  describe('Concurrent Interleaved Sending & Ordering', () => {
    it('preserves all messages with deterministic ordering under concurrent traffic from both users', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('intl_a', 'intl_b');

      // 5 messages from User A, 5 from User B concurrently
      const aPromises = Array.from({ length: 5 }).map((_, i) =>
        request(app.getHttpServer())
          .post(`/v1/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({
            clientMessageId: generateUuidV7(),
            body: `Message from A #${i}`,
          })
      );

      const bPromises = Array.from({ length: 5 }).map((_, i) =>
        request(app.getHttpServer())
          .post(`/v1/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({
            clientMessageId: generateUuidV7(),
            body: `Message from B #${i}`,
          })
      );

      const allResponses = await Promise.all([...aPromises, ...bPromises]);
      for (const res of allResponses) {
        expect(res.status).toBe(201);
      }

      // Query message history
      const listRes = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}/messages?limit=50`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(10);

      // Verify reverse chronological ordering (newest first)
      for (let i = 0; i < listRes.body.data.items.length - 1; i++) {
        const current = new Date(listRes.body.data.items[i].createdAt).getTime();
        const next = new Date(listRes.body.data.items[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('Concurrent Read Cursors & Monotonic Guarantee', () => {
    it('maintains monotonic cursor progression when multiple read updates arrive concurrently', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('read_a', 'read_b');

      // Send 3 sequential messages from User A
      const msgRes1 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Msg 1' });

      // Small delay to ensure timestamp monotonicity
      await new Promise((r) => setTimeout(r, 20));

      const msgRes2 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Msg 2' });

      await new Promise((r) => setTimeout(r, 20));

      const msgRes3 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Msg 3' });

      const id1 = msgRes1.body.data.message.id;
      const id2 = msgRes2.body.data.message.id;
      const id3 = msgRes3.body.data.message.id;

      // Mark msg3 as read first
      await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ messageId: id3 })
        .expect(200);

      // Concurrently attempt to mark id1 and id2 as read
      const staleReads = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/conversations/${conversationId}/read`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ messageId: id1 }),
        request(app.getHttpServer())
          .post(`/v1/conversations/${conversationId}/read`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ messageId: id2 }),
      ]);

      for (const res of staleReads) {
        expect(res.status).toBe(200);
      }

      // Check durable read cursor in DB: must still point to msg 3
      const [readState] = await databaseService.client
        .select()
        .from(conversationReadStates)
        .where(
          and(
            eq(conversationReadStates.conversationId, conversationId),
            eq(conversationReadStates.userId, userB.userId)
          )
        );

      expect(readState.lastReadMessageId).toBe(id3);
    });
  });
});
