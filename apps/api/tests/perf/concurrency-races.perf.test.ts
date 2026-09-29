import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, and, sql } from 'drizzle-orm';
import { createTestApp } from '../test-app.helper.js';
import { DatabaseService } from '../../src/infrastructure/database/database.service.js';
import {
  seedPerfDataset,
  purgePerfDataset,
  type PerfDatasetResult,
} from '../../src/infrastructure/database/seeds/perf-seed.js';
import { matches } from '../../src/infrastructure/database/drizzle/schema/matches.js';
import { userInteractions } from '../../src/infrastructure/database/drizzle/schema/interactions.js';
import { events, eventRsvps } from '../../src/infrastructure/database/drizzle/schema/events.js';
import { outboxEvents } from '../../src/infrastructure/database/drizzle/schema/outbox-events.js';
import { sessions } from '../../src/infrastructure/database/drizzle/schema/sessions.js';
import {
  TOKEN_SERVICE_TOKEN,
  type ITokenService,
} from '../../src/modules/auth/tokens/token.interface.js';
import { generateUuidV7 } from '@platform/domain';

describe('Performance: Concurrency Stress, Races & Contention Validation', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let tokenService: ITokenService;
  let perfData: PerfDatasetResult;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    tokenService = app.get(TOKEN_SERVICE_TOKEN);

    await purgePerfDataset(databaseService.drizzle);
    perfData = await seedPerfDataset(databaseService.drizzle);
  });

  afterAll(async () => {
    if (databaseService) {
      await purgePerfDataset(databaseService.drizzle);
    }
    await app.close();
  });

  async function createAuthenticatedUserToken(userId: string): Promise<string> {
    const sessionId = generateUuidV7();
    const refreshToken = tokenService.generateRefreshToken();
    await databaseService.client.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash: tokenService.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });

    return tokenService.generateAccessToken({
      sub: userId,
      sid: sessionId,
      dev: generateUuidV7(),
    });
  }

  it('1. Simultaneous Reciprocal Likes Concurrency: 10 concurrent pairs create exactly 1 match each with 0 deadlocks', async () => {
    const londonUsers = perfData.userMapByCluster['London'] || [];
    expect(londonUsers.length).toBeGreaterThanOrEqual(20);

    // Pick 10 pairs from unused range (e.g. index 30 to 50)
    const pairs: [string, string][] = [];
    for (let i = 0; i < 10; i++) {
      pairs.push([londonUsers[30 + i * 2], londonUsers[30 + i * 2 + 1]]);
    }

    const userTokens = new Map<string, string>();
    for (const [userA, userB] of pairs) {
      userTokens.set(userA, await createAuthenticatedUserToken(userA));
      userTokens.set(userB, await createAuthenticatedUserToken(userB));
    }

    const likePromises = pairs.flatMap(([userA, userB]) => {
      const tokenA = userTokens.get(userA)!;
      const tokenB = userTokens.get(userB)!;

      return [
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB}/like`)
          .set('Authorization', `Bearer ${tokenA}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userA}/like`)
          .set('Authorization', `Bearer ${tokenB}`),
      ];
    });

    const startTime = Date.now();
    const responses = await Promise.all(likePromises);
    const durationMs = Date.now() - startTime;

    console.log(`[PerfTest] 20 simultaneous reciprocal likes processed in ${durationMs}ms`);

    // Verify all requests succeeded (200 or 201)
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    // Verify database: exactly 1 match per pair
    for (const [userA, userB] of pairs) {
      const [first, second] = userA < userB ? [userA, userB] : [userB, userA];
      const matchRows = await databaseService.client
        .select()
        .from(matches)
        .where(and(eq(matches.userAId, first), eq(matches.userBId, second)));

      expect(matchRows.length).toBe(1);
      expect(matchRows[0].status).toBe('ACTIVE');
    }
  });

  it('2. Event RSVP Capacity Race: 10 concurrent requests for 2 remaining spots yields exactly 2 GOING and 8 WAITLISTED', async () => {
    const eventId = perfData.eventIds[0];
    const nyUsers = perfData.userMapByCluster['NewYork'] || [];
    expect(nyUsers.length).toBeGreaterThanOrEqual(10);

    const targetUsers = nyUsers.slice(0, 10);
    const rsvpTokens = await Promise.all(targetUsers.map((u) => createAuthenticatedUserToken(u)));

    // Fire 10 simultaneous RSVP requests
    const rsvpPromises = targetUsers.map((userId, idx) => {
      const token = rsvpTokens[idx];

      return request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'GOING' });
    });

    const startTime = Date.now();
    const responses = await Promise.all(rsvpPromises);
    const durationMs = Date.now() - startTime;

    console.log(`[PerfTest] 10 concurrent RSVPs processed in ${durationMs}ms`);

    // All should return 200 or 201
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    // Inspect RSVPs in DB
    const allRsvps = await databaseService.client
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));

    const goingRsvps = allRsvps.filter((r) => r.status === 'GOING');
    const waitlistedRsvps = allRsvps.filter((r) => r.status === 'WAITLISTED');

    // Event capacity was 5, pre-seeded with 3 attendees -> exactly 5 total GOING!
    console.log(
      `[PerfTest] Total GOING RSVPs: ${goingRsvps.length} (Capacity: 5), WAITLISTED: ${waitlistedRsvps.length}`
    );
    expect(goingRsvps.length).toBe(5);
    expect(waitlistedRsvps.length).toBe(8);

    // Verify event aggregate counts in events table
    const eventRow = await databaseService.client
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    expect(eventRow[0].attendeeCount).toBe(5);
    expect(eventRow[0].waitlistCount).toBe(8);
  });

  it('3. Concurrent Refresh Token Rotation: exactly 1 request succeeds while concurrent duplicates are rejected', async () => {
    const testUserId = perfData.userIds[5];
    const initialRefreshToken = tokenService.generateRefreshToken();
    const sessionId = generateUuidV7();

    await databaseService.client.insert(sessions).values({
      id: sessionId,
      userId: testUserId,
      tokenHash: tokenService.hashToken(initialRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });

    // Fire 5 concurrent refresh attempts with the same refresh token
    const refreshPromises = Array.from({ length: 5 }).map(() =>
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken })
    );

    const responses = await Promise.all(refreshPromises);

    const successCount = responses.filter((r) => r.status === 200).length;
    const rejectedCount = responses.filter((r) => r.status === 401 || r.status === 403).length;

    console.log(
      `[PerfTest] Concurrent token refresh: ${successCount} succeeded, ${rejectedCount} rejected`
    );

    // Exactly 1 must succeed; all concurrent replays must be rejected
    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(4);
  });

  it('4. Outbox Event Concurrent Processing: 5 concurrent workers claim distinct events without collision', async () => {
    // Insert 20 pending outbox events
    const testEvents = Array.from({ length: 20 }).map((_, idx) => ({
      id: generateUuidV7(),
      eventType: 'perf.test.event',
      aggregateType: 'PERF',
      aggregateId: `perf-${idx}`,
      payload: { iteration: idx },
      status: 'PENDING',
    }));

    await databaseService.client.insert(outboxEvents).values(testEvents);

    // Simulate 5 concurrent worker transactions claiming 4 items each using SELECT ... FOR UPDATE SKIP LOCKED
    const workerPromises = Array.from({ length: 5 }).map(async (workerIdx) => {
      return databaseService.withTransaction(async (tx) => {
        const claimed = await tx.execute(sql`
          UPDATE outbox_events
          SET status = 'PROCESSING', processed_at = NOW()
          WHERE id IN (
            SELECT id
            FROM outbox_events
            WHERE status = 'PENDING'
            LIMIT 4
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id;
        `);
        const rows = (claimed.rows || claimed) as { id: string }[];
        return { workerIdx, claimedIds: rows.map((r) => r.id) };
      });
    });

    const results = await Promise.all(workerPromises);
    const allClaimedIds = results.flatMap((r) => r.claimedIds);

    // Ensure all 20 events were claimed across the 5 workers with zero overlapping claims
    const uniqueClaimedIds = new Set(allClaimedIds);
    console.log(
      `[PerfTest] Outbox concurrent worker claim: claimed ${allClaimedIds.length} items (${uniqueClaimedIds.size} unique) across 5 workers`
    );

    expect(allClaimedIds.length).toBe(20);
    expect(uniqueClaimedIds.size).toBe(20);
  });
});
