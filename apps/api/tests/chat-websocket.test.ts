import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
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
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';

describe('Chat WebSocket Gateway & Realtime Events (Gate 08)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let wsUrl: string;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);

    // Listen on an ephemeral port for WebSocket connections
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    wsUrl = `http://localhost:${address.port}/chat`;
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
      dateOfBirth: '1995-10-10',
      gender: 'WOMAN',
      city: 'Bangalore',
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

  function createClientSocket(token?: string): Socket {
    return io(wsUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    });
  }

  describe('Handshake Authentication', () => {
    it('rejects connection when no auth token is provided', async () => {
      const socket = createClientSocket();

      const error = await new Promise<any>((resolve) => {
        socket.on('error', (err) => resolve(err));
        socket.on('disconnect', () => resolve({ disconnected: true }));
      });

      socket.disconnect();
      expect(error).toBeDefined();
    });

    it('rejects connection when token is invalid or corrupted', async () => {
      const socket = createClientSocket('invalid.corrupted.token');

      const error = await new Promise<any>((resolve) => {
        socket.on('error', (err) => resolve(err));
        socket.on('disconnect', () => resolve({ disconnected: true }));
      });

      socket.disconnect();
      expect(error).toBeDefined();
    });

    it('accepts connection with valid access token and receives authenticated event', async () => {
      const user = await createActiveUser('ws_auth');
      const socket = createClientSocket(user.accessToken);

      const authData = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
        socket.on('authenticated', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
        socket.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      socket.disconnect();
      expect(authData.userId).toBe(user.userId);
    });
  });

  describe('Room Authorization & Messaging Workflow', () => {
    it('rejects non-participant from joining a conversation room', async () => {
      const { conversationId } = await createMatchedPair('ws_pair_a', 'ws_pair_b');
      const outsider = await createActiveUser('ws_outsider');

      const socket = createClientSocket(outsider.accessToken);
      await new Promise((resolve) => socket.on('authenticated', resolve));

      const response = await new Promise<any>((resolve) => {
        socket.emit('join:conversation', { conversationId }, (res: any) => resolve(res));
      });

      socket.disconnect();
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('allows participant to join conversation and relays realtime messages between users', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('real_a', 'real_b');

      const socketA = createClientSocket(userA.accessToken);
      const socketB = createClientSocket(userB.accessToken);

      await Promise.all([
        new Promise((resolve) => socketA.on('authenticated', resolve)),
        new Promise((resolve) => socketB.on('authenticated', resolve)),
      ]);

      // Both users join conversation room
      const joinA = await new Promise<any>((resolve) =>
        socketA.emit('join:conversation', { conversationId }, resolve)
      );
      const joinB = await new Promise<any>((resolve) =>
        socketB.emit('join:conversation', { conversationId }, resolve)
      );

      expect(joinA.success).toBe(true);
      expect(joinB.success).toBe(true);

      // Setup listener on User B for message.created event
      const clientMessageId = generateUuidV7();
      const messagePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Message receive timeout')), 5000);
        socketB.on('message.created', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });

      // User A sends message via WebSocket
      const sendAck = await new Promise<any>((resolve) => {
        socketA.emit(
          'message:send',
          {
            conversationId,
            clientMessageId,
            body: 'Hello User B via WebSocket!',
          },
          resolve
        );
      });

      expect(sendAck.success).toBe(true);
      expect(sendAck.data.body).toBe('Hello User B via WebSocket!');

      // User B receives realtime message envelope
      const receivedEvent = await messagePromise;
      expect(receivedEvent.event).toBe('message.created');
      expect(receivedEvent.payload.body).toBe('Hello User B via WebSocket!');
      expect(receivedEvent.payload.senderUserId).toBe(userA.userId);

      socketA.disconnect();
      socketB.disconnect();
    });

    it('relays typing:start and typing:stop events between participants', async () => {
      const { userA, userB, conversationId } = await createMatchedPair('type_a', 'type_b');

      const socketA = createClientSocket(userA.accessToken);
      const socketB = createClientSocket(userB.accessToken);

      await Promise.all([
        new Promise((resolve) => socketA.on('authenticated', resolve)),
        new Promise((resolve) => socketB.on('authenticated', resolve)),
      ]);

      await Promise.all([
        new Promise((resolve) => socketA.emit('join:conversation', { conversationId }, resolve)),
        new Promise((resolve) => socketB.emit('join:conversation', { conversationId }, resolve)),
      ]);

      // User B listens for typing.started
      const typingStartedPromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Typing started timeout')), 5000);
        socketB.on('typing.started', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });

      // User A begins typing
      socketA.emit('typing:start', { conversationId });
      const startedEvent = await typingStartedPromise;
      expect(startedEvent.event).toBe('typing.started');
      expect(startedEvent.payload.userId).toBe(userA.userId);
      expect(startedEvent.payload.isTyping).toBe(true);

      // User B listens for typing.stopped
      const typingStoppedPromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Typing stopped timeout')), 5000);
        socketB.on('typing.stopped', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });

      // User A stops typing
      socketA.emit('typing:stop', { conversationId });
      const stoppedEvent = await typingStoppedPromise;
      expect(stoppedEvent.event).toBe('typing.stopped');
      expect(stoppedEvent.payload.userId).toBe(userA.userId);
      expect(stoppedEvent.payload.isTyping).toBe(false);

      socketA.disconnect();
      socketB.disconnect();
    });
  });
});
