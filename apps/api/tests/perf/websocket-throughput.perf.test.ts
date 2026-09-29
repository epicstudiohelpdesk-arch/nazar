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
  conversations,
} from '../../src/infrastructure/database/drizzle/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';

describe('WebSocket Gateway Throughput & Latency Benchmarks (Gate 17)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let wsUrl: string;

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

  function createClientSocket(token: string): Socket {
    return io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    });
  }

  it('measures concurrent websocket connection handshake latencies across 15 clients', async () => {
    const clientCount = 15;
    const users = await Promise.all(
      Array.from({ length: clientCount }).map((_, i) => createActiveUser(`ws_bench_${i}`))
    );

    const sockets: Socket[] = [];
    const connectionLatencies: number[] = [];

    const connectPromises = users.map((user) => {
      return new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const socket = createClientSocket(user.accessToken);
        sockets.push(socket);

        const timer = setTimeout(() => {
          reject(new Error(`Timeout connecting user ${user.userId}`));
        }, 8000);

        socket.on('authenticated', () => {
          const latency = performance.now() - start;
          connectionLatencies.push(latency);
          clearTimeout(timer);
          resolve();
        });

        socket.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    });

    await Promise.all(connectPromises);

    connectionLatencies.sort((a, b) => a - b);
    const p50 = connectionLatencies[Math.floor(connectionLatencies.length * 0.5)].toFixed(1);
    const p95 = connectionLatencies[Math.floor(connectionLatencies.length * 0.95)].toFixed(1);
    const max = connectionLatencies[connectionLatencies.length - 1].toFixed(1);

    console.log(
      `[Benchmark: WS Handshake] 15 clients authenticated concurrently. p50: ${p50}ms, p95: ${p95}ms, max: ${max}ms`
    );

    // Clean up sockets
    for (const socket of sockets) {
      socket.disconnect();
    }

    expect(connectionLatencies.length).toBe(clientCount);
    expect(Number(p50)).toBeLessThan(100); // p50 under 100ms
  });

  it('measures conversation join authorization latency and fanout delivery', async () => {
    const pair = await createMatchedPair('ws_pair_a', 'ws_pair_b');

    const socketA = createClientSocket(pair.userA.accessToken);
    const socketB = createClientSocket(pair.userB.accessToken);

    await Promise.all([
      new Promise<void>((resolve) => socketA.on('authenticated', () => resolve())),
      new Promise<void>((resolve) => socketB.on('authenticated', () => resolve())),
    ]);

    // Measure room join latency
    const joinStart = performance.now();
    const joinRes = await new Promise<{ success: boolean }>((resolve) => {
      socketA.emit(
        'join:conversation',
        { conversationId: pair.conversationId },
        (res: { success: boolean }) => resolve(res)
      );
    });
    const joinLatencyMs = performance.now() - joinStart;

    console.log(
      `[Benchmark: WS Room Join] Authorized join latency: ${joinLatencyMs.toFixed(1)}ms (success: ${joinRes.success})`
    );
    expect(joinRes.success).toBe(true);

    await new Promise<void>((resolve) => {
      socketB.emit('join:conversation', { conversationId: pair.conversationId }, () => resolve());
    });

    // Measure end-to-end message broadcast & fanout latency
    const messageSendStart = performance.now();
    const fanoutPromise = new Promise<{ latencyMs: number; event: any }>((resolve) => {
      socketB.on('message.created', (event) => {
        const latencyMs = performance.now() - messageSendStart;
        resolve({ latencyMs, event });
      });
    });

    socketA.emit('message:send', {
      conversationId: pair.conversationId,
      clientMessageId: generateUuidV7(),
      body: 'Hello realtime performance test!',
      messageType: 'TEXT',
    });

    const fanoutResult = await fanoutPromise;
    console.log(
      `[Benchmark: WS Message Fanout] End-to-end fanout delivery latency: ${fanoutResult.latencyMs.toFixed(1)}ms`
    );

    socketA.disconnect();
    socketB.disconnect();

    expect(fanoutResult.event).toBeDefined();
    expect(fanoutResult.event.payload.body).toBe('Hello realtime performance test!');
    expect(fanoutResult.latencyMs).toBeLessThan(150); // Under 150ms end-to-end DB + broadcast
  });
});
