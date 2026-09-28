import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: Dating Preferences Model & Validation', () => {
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
    const email = `pref_${generateUuidV7()}@example.com`;
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

  it('returns default preferences for a user who has not set custom preferences', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .get('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const prefs = res.body.data;
    expect(prefs.minAge).toBe(18);
    expect(prefs.maxAge).toBe(99);
    expect(prefs.maxDistanceKm).toBe(50);
    expect(prefs.genderPreferences).toEqual(['WOMAN', 'MAN', 'NON_BINARY', 'OTHER']);
    expect(prefs.relationshipIntent).toBe('LONG_TERM');
  });

  it('rejects preferences update where minAge > maxAge', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        minAge: 35,
        maxAge: 25,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects preferences update with invalid distance bounds (e.g. 0 or > 500)', async () => {
    const session = await createSession();

    const resZero = await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        maxDistanceKm: 0,
      });

    expect(resZero.status).toBe(400);

    const resExcessive = await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        maxDistanceKm: 1000,
      });

    expect(resExcessive.status).toBe(400);
  });

  it('rejects preferences with empty gender preferences array', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        genderPreferences: [],
      });

    expect(res.status).toBe(400);
  });

  it('persists and updates valid dating preferences', async () => {
    const session = await createSession();

    const updateRes = await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        minAge: 22,
        maxAge: 30,
        genderPreferences: ['WOMAN'],
        maxDistanceKm: 25,
        relationshipIntent: 'LONG_TERM',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.minAge).toBe(22);
    expect(updateRes.body.data.maxAge).toBe(30);
    expect(updateRes.body.data.genderPreferences).toEqual(['WOMAN']);
    expect(updateRes.body.data.maxDistanceKm).toBe(25);
    expect(updateRes.body.data.relationshipIntent).toBe('LONG_TERM');

    // Retrieve via GET to verify persistence
    const getRes = await request(app.getHttpServer())
      .get('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.minAge).toBe(22);
    expect(getRes.body.data.maxAge).toBe(30);
    expect(getRes.body.data.maxDistanceKm).toBe(25);
  });
});
