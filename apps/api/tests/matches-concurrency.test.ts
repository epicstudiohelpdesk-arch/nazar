import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq, and, or } from 'drizzle-orm';
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
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';
import { normalizeUserPair } from '../src/modules/matches/domain/match.utils.js';

describe('Matches & Concurrency Engine (Gate 07)', () => {
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

  async function createActiveUser(
    prefix: string,
    overrides?: { dateOfBirth?: string; minAge?: number; maxAge?: number }
  ) {
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
      dateOfBirth: overrides?.dateOfBirth ?? '1996-03-20',
      gender: 'MAN',
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
      minAge: overrides?.minAge ?? 18,
      maxAge: overrides?.maxAge ?? 40,
      genderPreferences: ['MAN', 'WOMAN'],
      maxDistanceKm: 100,
      relationshipIntent: 'LONG_TERM',
    });

    return { userId, profileId, accessToken };
  }

  describe('Sequential Reciprocal LIKE & Match Creation', () => {
    it('creates exactly one match when B reciprocates A like', async () => {
      const userA = await createActiveUser('alice_seq');
      const userB = await createActiveUser('bob_seq');

      // 1. A likes B
      const resA = await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.matched).toBe(false);
      expect(resA.body.data.matchId).toBeNull();

      // 2. B likes A (Reciprocal like)
      const resB = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.matched).toBe(true);
      expect(typeof resB.body.data.matchId).toBe('string');
      const matchId = resB.body.data.matchId;

      // 3. Verify database match row
      const { userAId, userBId } = normalizeUserPair(userA.userId, userB.userId);
      const matchRows = await databaseService.client
        .select()
        .from(matches)
        .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)));

      expect(matchRows).toHaveLength(1);
      expect(matchRows[0].id).toBe(matchId);
      expect(matchRows[0].status).toBe('ACTIVE');

      // 4. Verify match.created outbox event was emitted exactly once
      const matchEvents = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(eq(outboxEvents.aggregateId, matchId), eq(outboxEvents.eventType, 'match.created'))
        );

      expect(matchEvents).toHaveLength(1);
      expect(matchEvents[0].payload).toMatchObject({
        matchId,
        userAId,
        userBId,
      });
    });
  });

  describe('Concurrency & Race Condition Invariants (Requirement 54)', () => {
    it('Case 1: Simultaneous mutual likes yield exactly 1 match and 1 match.created event', async () => {
      const userA = await createActiveUser('concurrent_a');
      const userB = await createActiveUser('concurrent_b');

      // Fire A likes B and B likes A at the exact same instant
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userA.userId}/like`)
          .set('Authorization', `Bearer ${userB.accessToken}`),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // At least one of the requests (or both, depending on commit order) returns matched: true
      const matchId = resA.body.data.matchId || resB.body.data.matchId;
      expect(matchId).toBeTruthy();

      // Check database: EXACTLY 1 row in matches table
      const { userAId, userBId } = normalizeUserPair(userA.userId, userB.userId);
      const matchRows = await databaseService.client
        .select()
        .from(matches)
        .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)));

      expect(matchRows).toHaveLength(1);
      expect(matchRows[0].status).toBe('ACTIVE');

      // Check outbox: EXACTLY 1 match.created event
      const matchEvents = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.aggregateId, matchRows[0].id),
            eq(outboxEvents.eventType, 'match.created')
          )
        );

      expect(matchEvents).toHaveLength(1);

      // Check directional interactions: exactly 1 per direction
      const rowsAtoB = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, userA.userId),
            eq(userInteractions.targetUserId, userB.userId)
          )
        );
      const rowsBtoA = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, userB.userId),
            eq(userInteractions.targetUserId, userA.userId)
          )
        );

      expect(rowsAtoB).toHaveLength(1);
      expect(rowsBtoA).toHaveLength(1);
    });

    it('Case 2: Concurrent duplicate likes in the same direction yield 0 duplicate rows', async () => {
      const userA = await createActiveUser('spam_actor');
      const userB = await createActiveUser('spam_target');

      // Send 5 concurrent likes from A to B
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/interactions/${userB.userId}/like`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
      ]);

      // All requests must respond with 200 without throwing 500 DB constraint errors
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      // Check interaction rows
      const rows = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, userA.userId),
            eq(userInteractions.targetUserId, userB.userId)
          )
        );

      expect(rows).toHaveLength(1);
    });
  });

  describe('Matches Retrieval & Object-Level Authorization (Requirements 26, 27, 28, 58)', () => {
    it('returns paginated matches for authenticated member and enforces cursor pagination', async () => {
      const userA = await createActiveUser('match_member_a');
      const userB = await createActiveUser('match_member_b');
      const userC = await createActiveUser('match_member_c');

      // Create Match A-B
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      // Create Match A-C
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userC.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userC.accessToken}`);

      // Query limit=1
      const resPage1 = await request(app.getHttpServer())
        .get('/v1/matches?limit=1')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.items).toHaveLength(1);
      expect(resPage1.body.data.pagination.hasMore).toBe(true);
      expect(resPage1.body.data.pagination.nextCursor).toBeTruthy();

      // Query page 2 with cursor
      const cursor = resPage1.body.data.pagination.nextCursor;
      const resPage2 = await request(app.getHttpServer())
        .get(`/v1/matches?limit=1&cursor=${cursor}`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.data.items).toHaveLength(1);
      // Ensure different match returned
      expect(resPage2.body.data.items[0].id).not.toBe(resPage1.body.data.items[0].id);
    });

    it('allows a match member to view match details', async () => {
      const userA = await createActiveUser('detail_a');
      const userB = await createActiveUser('detail_b');

      await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      const matchRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      const matchId = matchRes.body.data.matchId;

      const detailRes = await request(app.getHttpServer())
        .get(`/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(matchId);
      expect(detailRes.body.data.otherUser.userId).toBe(userB.userId);
      expect(detailRes.body.data.otherUser.displayName).toBe('detail_b User');
    });

    it('strictly forbids a non-member from viewing or unmatching a match (403 MATCH_ACCESS_DENIED)', async () => {
      const userA = await createActiveUser('member_a');
      const userB = await createActiveUser('member_b');
      const userSnoop = await createActiveUser('snoop_user');

      // Create Match A-B
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      const matchRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      const matchId = matchRes.body.data.matchId;

      // Snoop tries to GET A-B match
      const getRes = await request(app.getHttpServer())
        .get(`/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${userSnoop.accessToken}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.error.code).toBe(ErrorCode.MATCH_ACCESS_DENIED);

      // Snoop tries to DELETE (unmatch) A-B match
      const deleteRes = await request(app.getHttpServer())
        .delete(`/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${userSnoop.accessToken}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe(ErrorCode.MATCH_ACCESS_DENIED);
    });
  });

  describe('Unmatch Lifecycle (DELETE /v1/matches/:matchId)', () => {
    it('transitions match status to UNMATCHED, emits match.unmatched event, and removes from active matches', async () => {
      const userA = await createActiveUser('unmatch_a');
      const userB = await createActiveUser('unmatch_b');

      await request(app.getHttpServer())
        .post(`/v1/interactions/${userB.userId}/like`)
        .set('Authorization', `Bearer ${userA.accessToken}`);
      const matchRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      const matchId = matchRes.body.data.matchId;

      // User A unmatches
      const unmatchRes = await request(app.getHttpServer())
        .delete(`/v1/matches/${matchId}`)
        .send({ reason: 'LOST_INTEREST' })
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(unmatchRes.status).toBe(200);
      expect(unmatchRes.body.data).toEqual({
        success: true,
        matchId,
        status: 'UNMATCHED',
      });

      // Verify DB record
      const matchRow = await databaseService.client
        .select()
        .from(matches)
        .where(eq(matches.id, matchId));

      expect(matchRow[0].status).toBe('UNMATCHED');
      expect(matchRow[0].unmatchedByUserId).toBe(userA.userId);
      expect(matchRow[0].unmatchedReason).toBe('LOST_INTEREST');

      // Verify outbox event
      const events = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(eq(outboxEvents.aggregateId, matchId), eq(outboxEvents.eventType, 'match.unmatched'))
        );

      expect(events).toHaveLength(1);

      // Verify GET /v1/matches no longer lists this match in active matches
      const listRes = await request(app.getHttpServer())
        .get('/v1/matches')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(listRes.body.data.items).toHaveLength(0);
    });
  });

  describe('Discovery Exclusion Integration (Requirements 31, 32, 33)', () => {
    it('excludes liked, passed, and matched users from the discovery feed', async () => {
      const elderAgeOpts = { dateOfBirth: '1934-01-01', minAge: 91, maxAge: 93 };
      const viewer = await createActiveUser('viewer_excl', elderAgeOpts);
      const candidate1 = await createActiveUser('cand_1', elderAgeOpts);
      const candidate2 = await createActiveUser('cand_2', elderAgeOpts);
      const candidate3 = await createActiveUser('cand_3', elderAgeOpts);

      // Initial discovery feed contains isolated candidates
      const feedInitial = await request(app.getHttpServer())
        .get('/v1/discovery?limit=50')
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      expect(feedInitial.status).toBe(200);
      const initialIds = feedInitial.body.data.items.map((i: any) => i.profile.userId);
      expect(initialIds).toContain(candidate1.userId);
      expect(initialIds).toContain(candidate2.userId);
      expect(initialIds).toContain(candidate3.userId);

      // 1. Viewer passes candidate 1
      await request(app.getHttpServer())
        .post(`/v1/interactions/${candidate1.userId}/pass`)
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      // 2. Viewer likes candidate 2
      await request(app.getHttpServer())
        .post(`/v1/interactions/${candidate2.userId}/like`)
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      // 3. Query discovery again - candidate 1 and candidate 2 must be excluded!
      const feedAfter = await request(app.getHttpServer())
        .get('/v1/discovery?limit=50')
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      const remainingIds = feedAfter.body.data.items.map((i: any) => i.profile.userId);
      expect(remainingIds).not.toContain(candidate1.userId);
      expect(remainingIds).not.toContain(candidate2.userId);
      expect(remainingIds).toContain(candidate3.userId);

      // 4. Undo the last action (the like on candidate 2)
      await request(app.getHttpServer())
        .post('/v1/interactions/undo')
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      // Candidate 2 reappears in discovery!
      const feedAfterUndo = await request(app.getHttpServer())
        .get('/v1/discovery?limit=50')
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      const postUndoIds = feedAfterUndo.body.data.items.map((i: any) => i.profile.userId);
      expect(postUndoIds).toContain(candidate2.userId);
      expect(postUndoIds).toContain(candidate3.userId);
      expect(postUndoIds).not.toContain(candidate1.userId);
    });
  });
});
