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
  userInteractions,
  matches,
  conversations,
  messages,
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Chat & Messaging REST API (Gate 08)', () => {
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
      dateOfBirth: '1998-06-15',
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

    // User A likes User B
    await request(app.getHttpServer())
      .post(`/v1/interactions/${userB.userId}/like`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);

    // User B likes User A -> triggers reciprocal match and auto-creates conversation
    const resB = await request(app.getHttpServer())
      .post(`/v1/interactions/${userA.userId}/like`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);

    const matchId = resB.body.data.matchId as string;
    expect(matchId).toBeDefined();

    // Verify conversation was created
    const [conv] = await databaseService.client
      .select()
      .from(conversations)
      .where(eq(conversations.matchId, matchId))
      .limit(1);

    expect(conv).toBeDefined();
    expect(conv.status).toBe('ACTIVE');

    return { userA, userB, matchId, conversationId: conv.id };
  }

  describe('Conversation Listing & Access Control', () => {
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer()).get('/v1/conversations');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('returns empty list when user has no conversations', async () => {
      const loner = await createActiveUser('loner');
      const res = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${loner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.hasMore).toBe(false);
      expect(res.body.data.nextCursor).toBeNull();
    });

    it('returns active conversations with partner details for matched users', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('list_a', 'list_b');

      // User A queries conversations
      const resA = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.items).toHaveLength(1);
      expect(resA.body.data.items[0].id).toBe(conversationId);
      expect(resA.body.data.items[0].otherUser.userId).toBe(userB.userId);
      expect(resA.body.data.items[0].otherUser.displayName).toBe('list_b User');
      expect(resA.body.data.items[0].unreadCount).toBe(0);

      // User B queries conversations
      const resB = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.items).toHaveLength(1);
      expect(resB.body.data.items[0].id).toBe(conversationId);
      expect(resB.body.data.items[0].otherUser.userId).toBe(userA.userId);
      expect(resB.body.data.items[0].otherUser.displayName).toBe('list_a User');
    });

    it('rejects access to conversation detail by non-participant with 403 CONVERSATION_ACCESS_DENIED', async () => {
      const { conversationId } = await createMatchedPair('pair_a', 'pair_b');
      const outsider = await createActiveUser('outsider');

      const res = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.CONVERSATION_ACCESS_DENIED);
    });

    it('returns 404 CONVERSATION_NOT_FOUND for non-existent conversation ID', async () => {
      const user = await createActiveUser('user_404');
      const nonExistentId = generateUuidV7();

      const res = await request(app.getHttpServer())
        .get(`/v1/conversations/${nonExistentId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
    });
  });

  describe('Message Sending (POST /v1/conversations/:id/messages)', () => {
    it('successfully sends a message and emits outbox event', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('send_a', 'send_b');
      const clientMessageId = generateUuidV7();

      const res = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId,
          body: 'Hello, this is a test message!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.message.body).toBe('Hello, this is a test message!');
      expect(res.body.data.message.senderUserId).toBe(userA.userId);
      expect(res.body.data.message.clientMessageId).toBe(clientMessageId);
      expect(res.body.data.message.deliveryState).toBe('SENT');

      // Verify conversation preview and lastMessageAt were updated
      const convRes = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(convRes.body.data.items[0].lastMessage).toBeDefined();
      expect(convRes.body.data.items[0].lastMessage.preview).toBe('Hello, this is a test message!');

      // Verify unread count for recipient User B
      const listB = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(listB.body.data.items[0].unreadCount).toBe(1);

      // Verify outbox event was recorded
      const outbox = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.aggregateType, 'MESSAGE'),
            eq(outboxEvents.eventType, 'message.created')
          )
        );

      expect(outbox.length).toBeGreaterThan(0);
      const matchingEvent = outbox.find((e) => (e.payload as any).clientMessageId === clientMessageId);
      expect(matchingEvent).toBeDefined();
    });

    it('rejects sending messages by an outsider with 403 CONVERSATION_ACCESS_DENIED', async () => {
      const { conversationId } = await createMatchedPair('auth_a', 'auth_b');
      const hacker = await createActiveUser('hacker');

      const res = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${hacker.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'I am breaking in',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.CONVERSATION_ACCESS_DENIED);
    });

    it('rejects empty or whitespace-only messages with 400 validation error', async () => {
      const { userA, conversationId } = await createMatchedPair('valid_a', 'valid_b');

      const resEmpty = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: '',
        });

      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: '    \n\t  ',
        });

      expect(resWhitespace.status).toBe(400);
    });

    it('rejects messages longer than 2000 characters with 400 validation error', async () => {
      const { userA, conversationId } = await createMatchedPair('len_a', 'len_b');
      const longBody = 'a'.repeat(2001);

      const res = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: longBody,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Delivery State & Monotonic Read Receipts', () => {
    it('progresses delivery state from SENT to DELIVERED and READ as recipient acts', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('state_a', 'state_b');

      // 1. User A sends message
      const sendRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Check delivery states',
        });

      const messageId = sendRes.body.data.message.id as string;
      expect(sendRes.body.data.message.deliveryState).toBe('SENT');

      // 2. User B marks as delivered
      const delivRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/delivered`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ messageId });

      expect(delivRes.status).toBe(200);

      // User A inspects messages: state is now DELIVERED
      const msgsAfterDeliv = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(msgsAfterDeliv.body.data.items[0].deliveryState).toBe('DELIVERED');

      // 3. User B marks as read
      const readRes = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ messageId });

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.success).toBe(true);
      expect(readRes.body.data.lastReadMessageId).toBe(messageId);

      // Verify unread count is 0 for User B in conversation list
      const listAfterRead = await request(app.getHttpServer())
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${userB.accessToken}`);
      expect(listAfterRead.body.data.items[0].unreadCount).toBe(0);

      // User A inspects messages: state is now READ
      const msgsAfterRead = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(msgsAfterRead.body.data.items[0].deliveryState).toBe('READ');
    });

    it('enforces monotonic read cursor (cannot regress backwards)', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('mono_a', 'mono_b');

      // Send message 1
      const msg1 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Message 1' });

      // Send message 2
      const msg2 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Message 2' });

      // Mark message 2 as read
      await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ messageId: msg2.body.data.message.id })
        .expect(200);

      // Now try to mark message 1 (earlier) as read
      const staleRead = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ messageId: msg1.body.data.message.id });

      expect(staleRead.status).toBe(200);
      // The cursor did not regress; lastReadMessageId remains message 2
      expect(staleRead.body.data.lastReadMessageId).toBe(msg2.body.data.message.id);
    });
  });

  describe('Unmatch Lifecycle & Conversation Closure', () => {
    it('closes conversation when match is unmatched and blocks subsequent message sending', async () => {
      const { userA, userB, matchId, conversationId } = await createMatchedPair('unmatch_a', 'unmatch_b');

      // User A unmatches User B
      const unmatchRes = await request(app.getHttpServer())
        .delete(`/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ reason: 'USER_INITIATED' });

      expect(unmatchRes.status).toBe(200);
      expect(unmatchRes.body.data.status).toBe('UNMATCHED');

      // Verify conversation status is CLOSED
      const convDetail = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(convDetail.status).toBe(200);
      expect(convDetail.body.data.status).toBe('CLOSED');

      // Attempt to send a message to the closed conversation -> 400 CONVERSATION_CLOSED
      const sendAttempt = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          clientMessageId: generateUuidV7(),
          body: 'Are you still there?',
        });

      expect(sendAttempt.status).toBe(400);
      expect(sendAttempt.body.error.code).toBe(ErrorCode.CONVERSATION_CLOSED);

      // Verify outbox event 'conversation.closed' was recorded
      const outbox = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.aggregateType, 'CONVERSATION'),
            eq(outboxEvents.eventType, 'conversation.closed')
          )
        );

      expect(outbox.length).toBeGreaterThan(0);
    });
  });

  describe('Reconnect Synchronization (GET /v1/conversations/:id/sync)', () => {
    it('returns only messages created after the sinceMessageId', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('sync_a', 'sync_b');

      // Message 1
      const msg1 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Sync Msg 1' });

      const msg1Id = msg1.body.data.message.id;

      // Message 2
      const msg2 = await request(app.getHttpServer())
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ clientMessageId: generateUuidV7(), body: 'Sync Msg 2' });

      const msg2Id = msg2.body.data.message.id;

      // Sync since message 1
      const syncRes = await request(app.getHttpServer())
        .get(`/v1/conversations/${conversationId}/sync?sinceMessageId=${msg1Id}`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(syncRes.status).toBe(200);
      expect(syncRes.body.data.messages).toHaveLength(1);
      expect(syncRes.body.data.messages[0].id).toBe(msg2Id);
      expect(syncRes.body.data.messages[0].body).toBe('Sync Msg 2');
    });
  });
});
