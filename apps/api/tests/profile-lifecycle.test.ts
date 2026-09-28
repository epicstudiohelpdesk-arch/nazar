import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: Lifecycle State Machine Transitions', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSession() {
    const email = `lifecycle_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id as string,
      accessToken: res.body.data.accessToken as string,
    };
  }

  it('initializes profile in DRAFT state', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 22}-03-10`;

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Sam',
        dateOfBirth: dob,
        gender: 'NON_BINARY',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.visibility).toBe('DRAFT');
  });

  it('rejects pausing or hiding a DRAFT profile with 400 PROFILE_STATE_INVALID', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 23}-04-12`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'DraftUser',
        dateOfBirth: dob,
        gender: 'MAN',
      });

    const pauseRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/pause')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(pauseRes.status).toBe(400);
    expect(pauseRes.body.error.code).toBe('PROFILE_STATE_INVALID');

    const hideRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/hide')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(hideRes.status).toBe(400);
    expect(hideRes.body.error.code).toBe('PROFILE_STATE_INVALID');
  });

  it('rejects activation when profile is incomplete (missing photo, prompts, interests)', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 25}-01-01`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'IncompleteUser',
        dateOfBirth: dob,
        gender: 'WOMAN',
      });

    const activateRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/activate')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(activateRes.status).toBe(400);
    expect(activateRes.body.error.code).toBe('PROFILE_INCOMPLETE');
    expect(Array.isArray(activateRes.body.error.details)).toBe(true);
    expect(activateRes.body.error.details.length).toBeGreaterThan(0);
  });

  it('successfully transitions DRAFT -> ACTIVE when all criteria are satisfied, then to PAUSED, and back to ACTIVE', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 26}-06-15`;

    // 1. Basic profile
    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Elena Rostova',
        dateOfBirth: dob,
        gender: 'WOMAN',
        bio: 'Art director, coffee connoisseur, hiker',
      });

    // 2. Preferences
    await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        minAge: 24,
        maxAge: 32,
        genderPreferences: ['MAN'],
        maxDistanceKm: 60,
      });

    // 3. Upload & complete at least 1 photo
    const uploadRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 500,
      });

    const mediaId = uploadRes.body.data.mediaId;
    await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${mediaId}/complete`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    // 4. Select at least 3 interests
    const interestsTaxonomyRes = await request(app.getHttpServer()).get('/v1/interests');
    const availableInterests = interestsTaxonomyRes.body.data;
    expect(availableInterests.length).toBeGreaterThanOrEqual(3);
    const selectedInterests = availableInterests.slice(0, 3).map((i: any) => i.id);

    await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ interestIds: selectedInterests });

    // 5. Answer at least 1 prompt
    const promptsTaxonomyRes = await request(app.getHttpServer()).get('/v1/prompts');
    const availablePrompts = promptsTaxonomyRes.body.data;
    expect(availablePrompts.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        prompts: [
          {
            promptDefinitionId: availablePrompts[0].id,
            answerText: 'My ideal Sunday is making pour-over coffee and reading.',
          },
        ],
      });

    // 6. Activate profile (DRAFT -> ACTIVE)
    const activateRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/activate')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.success).toBe(true);
    expect(activateRes.body.data.visibility).toBe('ACTIVE');

    // Verify GET /v1/profiles/me reports ACTIVE
    const meRes = await request(app.getHttpServer())
      .get('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(meRes.body.data.visibility).toBe('ACTIVE');

    // 7. Pause profile (ACTIVE -> PAUSED)
    const pauseRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/pause')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.visibility).toBe('PAUSED');

    // 8. Re-activate profile (PAUSED -> ACTIVE)
    const reactivateRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/activate')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.visibility).toBe('ACTIVE');

    // 9. Hide profile (ACTIVE -> HIDDEN)
    const hideRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/hide')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(hideRes.status).toBe(200);
    expect(hideRes.body.data.visibility).toBe('HIDDEN');
  });
});
