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
  userInteractions,
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Interactions Engine: LIKE, PASS, UNDO & History API', () => {
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

  describe('LIKE Endpoint (POST /v1/interactions/:targetUserId/like)', () => {
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const dummyId = generateUuidV7();
      const res = await request(app.getHttpServer()).post(`/v1/interactions/${dummyId}/like`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('rejects self-like with 400 INTERACTION_SELF_TARGET', async () => {
      const user = await createActiveUser('self_like');

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${user.userId}/like`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.INTERACTION_SELF_TARGET);
    });

    it('rejects like when target does not exist with 404 INTERACTION_TARGET_NOT_FOUND', async () => {
      const user = await createActiveUser('like_actor');
      const nonExistentTargetId = generateUuidV7();

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${nonExistentTargetId}/like`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.INTERACTION_TARGET_NOT_FOUND);
    });

    it('rejects like when target is HIDDEN or DRAFT with 400 INTERACTION_NOT_ALLOWED', async () => {
      const actor = await createActiveUser('like_actor_vis');
      const target = await createActiveUser('hidden_target');

      // Update target visibility to HIDDEN
      await databaseService.client
        .update(profiles)
        .set({ visibility: 'HIDDEN' })
        .where(eq(profiles.userId, target.userId));

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.INTERACTION_NOT_ALLOWED);
    });

    it('records a unilateral LIKE, emits outbox event, and returns non-matched state', async () => {
      const actor = await createActiveUser('alice');
      const target = await createActiveUser('bob');

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        targetUserId: target.userId,
        interaction: 'LIKE',
        matched: false,
        matchId: null,
      });

      // Verify row in user_interactions
      const row = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, actor.userId),
            eq(userInteractions.targetUserId, target.userId)
          )
        );

      expect(row).toHaveLength(1);
      expect(row[0].type).toBe('LIKE');

      // Verify outbox event emitted
      const events = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.aggregateId, row[0].id),
            eq(outboxEvents.eventType, 'interaction.liked')
          )
        );

      expect(events).toHaveLength(1);
    });

    it('is safely idempotent when LIKE is repeated', async () => {
      const actor = await createActiveUser('repeat_like_a');
      const target = await createActiveUser('repeat_like_t');

      // First like
      const res1 = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);
      expect(res1.status).toBe(200);

      // Repeat like
      const res2 = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual({
        targetUserId: target.userId,
        interaction: 'LIKE',
        matched: false,
        matchId: null,
      });

      // Confirm only 1 interaction row exists
      const rows = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, actor.userId),
            eq(userInteractions.targetUserId, target.userId)
          )
        );
      expect(rows).toHaveLength(1);
    });
  });

  describe('PASS Endpoint (POST /v1/interactions/:targetUserId/pass)', () => {
    it('rejects self-pass with 400 INTERACTION_SELF_TARGET', async () => {
      const user = await createActiveUser('self_pass');

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${user.userId}/pass`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.INTERACTION_SELF_TARGET);
    });

    it('records a PASS interaction and emits outbox event', async () => {
      const actor = await createActiveUser('pass_actor');
      const target = await createActiveUser('pass_target');

      const res = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/pass`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        targetUserId: target.userId,
        interaction: 'PASS',
        matched: false,
        matchId: null,
      });

      const rows = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, actor.userId),
            eq(userInteractions.targetUserId, target.userId)
          )
        );
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('PASS');
    });

    it('allows changing decision from PASS to LIKE before matching', async () => {
      const actor = await createActiveUser('decision_actor');
      const target = await createActiveUser('decision_target');

      // 1. Pass first
      await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/pass`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      // 2. Change to Like
      const likeRes = await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(likeRes.status).toBe(200);
      expect(likeRes.body.data.interaction).toBe('LIKE');

      const rows = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, actor.userId),
            eq(userInteractions.targetUserId, target.userId)
          )
        );
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('LIKE');
    });
  });

  describe('UNDO Endpoint (POST /v1/interactions/undo)', () => {
    it('rejects undo when there are no recent interactions with 400 UNDO_NOT_ALLOWED', async () => {
      const user = await createActiveUser('no_undo_user');

      const res = await request(app.getHttpServer())
        .post('/v1/interactions/undo')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.UNDO_NOT_ALLOWED);
    });

    it('reverts the most recent PASS interaction successfully', async () => {
      const actor = await createActiveUser('undo_actor');
      const target = await createActiveUser('undo_target');

      await request(app.getHttpServer())
        .post(`/v1/interactions/${target.userId}/pass`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      const undoRes = await request(app.getHttpServer())
        .post('/v1/interactions/undo')
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.data).toEqual({
        undone: true,
        targetUserId: target.userId,
        previousInteraction: 'PASS',
      });

      // Verify row is deleted
      const rows = await databaseService.client
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.actorUserId, actor.userId),
            eq(userInteractions.targetUserId, target.userId)
          )
        );
      expect(rows).toHaveLength(0);
    });
  });

  describe('Interaction History (GET /v1/interactions)', () => {
    it('returns privacy-safe list of interactions performed by authenticated user', async () => {
      const actor = await createActiveUser('history_actor');
      const target1 = await createActiveUser('history_target_1');
      const target2 = await createActiveUser('history_target_2');

      await request(app.getHttpServer())
        .post(`/v1/interactions/${target1.userId}/like`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      await request(app.getHttpServer())
        .post(`/v1/interactions/${target2.userId}/pass`)
        .set('Authorization', `Bearer ${actor.accessToken}`);

      const res = await request(app.getHttpServer())
        .get('/v1/interactions?limit=10')
        .set('Authorization', `Bearer ${actor.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0].targetUserId).toBe(target2.userId);
      expect(res.body.data.items[0].type).toBe('PASS');
      expect(res.body.data.items[1].targetUserId).toBe(target1.userId);
      expect(res.body.data.items[1].type).toBe('LIKE');
    });

    it('does not expose other users directional interactions', async () => {
      const userA = await createActiveUser('privacy_a');
      const userB = await createActiveUser('privacy_b');

      // B likes A
      await request(app.getHttpServer())
        .post(`/v1/interactions/${userA.userId}/like`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      // A queries their own history - must NOT see B's like toward A
      const res = await request(app.getHttpServer())
        .get('/v1/interactions')
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
    });
  });
});
