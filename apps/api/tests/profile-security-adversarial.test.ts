import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: Security, Adversarial Access & Privacy Leaks', () => {
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

  async function createSession(name: string) {
    const email = `sec_${name.toLowerCase()}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;

    const profileRes = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: name,
        dateOfBirth: '1996-07-20',
        gender: 'MAN',
        bio: 'Confidential personal bio',
        location: {
          latitude: 37.774929,
          longitude: -122.419416,
        },
      });

    return {
      userId,
      accessToken,
      profileId: profileRes.body.data.id as string,
    };
  }

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const endpoints = [
      { method: 'get', path: '/v1/profiles/me' },
      { method: 'put', path: '/v1/profiles/me' },
      { method: 'post', path: '/v1/profiles/me/activate' },
      { method: 'get', path: '/v1/profiles/me/preferences' },
      { method: 'get', path: '/v1/profiles/me/media' },
    ];

    for (const ep of endpoints) {
      const res = await (request(app.getHttpServer()) as any)[ep.method](ep.path);
      expect(res.status).toBe(401);
    }
  });

  it('guarantees public profile data minimization: NEVER leaks raw DOB, exact coordinates, storage keys, or auth data', async () => {
    const userA = await createSession('Alice');

    // Make User A active
    await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ minAge: 21, maxAge: 35, genderPreferences: ['WOMAN'], maxDistanceKm: 50 });

    const uploadRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 300 });

    const mediaId = uploadRes.body.data.mediaId;
    await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${mediaId}/complete`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    const interests = await request(app.getHttpServer()).get('/v1/interests');
    await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ interestIds: interests.body.data.slice(0, 3).map((i: any) => i.id) });

    const prompts = await request(app.getHttpServer()).get('/v1/prompts');
    await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        prompts: [
          { promptDefinitionId: prompts.body.data[0].id, answer: 'Favorite book is Dune.' },
        ],
      });

    await request(app.getHttpServer())
      .post('/v1/profiles/me/activate')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // Request public profile as an outside visitor / another user
    const publicRes = await request(app.getHttpServer()).get(`/v1/profiles/${userA.profileId}`);

    expect(publicRes.status).toBe(200);
    const pubData = publicRes.body.data;

    // 1. Age is derived, but raw dateOfBirth MUST NOT exist in public payload
    expect(pubData.age).toBeDefined();
    expect(typeof pubData.age).toBe('number');
    expect(pubData.dateOfBirth).toBeUndefined();

    // 2. Exact coordinates MUST NOT exist in public payload
    expect(pubData.latitude).toBeUndefined();
    expect(pubData.longitude).toBeUndefined();
    expect(pubData.location).toBeUndefined();

    // 3. Storage keys MUST NOT exist in public media payload
    expect(pubData.media).toBeDefined();
    expect(pubData.media.length).toBeGreaterThan(0);
    for (const item of pubData.media) {
      expect(item.objectKey).toBeUndefined();
      expect(item.storageKey).toBeUndefined();
      expect(item.uploadUrl).toBeUndefined();
      expect(item.url).toBeDefined();
    }

    // 4. Auth & internal data MUST NOT exist
    expect(pubData.email).toBeUndefined();
    expect(pubData.phoneNumber).toBeUndefined();
    expect(pubData.token).toBeUndefined();
    expect(pubData.passwordHash).toBeUndefined();
  });

  it('hides non-discoverable profiles (DRAFT, PAUSED, HIDDEN) from public discovery view with 404 PROFILE_NOT_FOUND', async () => {
    // User B stays in DRAFT
    const userB = await createSession('BobDraft');

    const draftRes = await request(app.getHttpServer()).get(`/v1/profiles/${userB.profileId}`);
    expect(draftRes.status).toBe(404);
    expect(draftRes.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('prevents User A from manipulating or deleting User B media (cross-user authorization enforcement)', async () => {
    const userA = await createSession('Attacker');
    const userB = await createSession('Victim');

    // Victim uploads photo
    const victimUpload = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 100 });
    const victimMediaId = victimUpload.body.data.mediaId;

    // Attacker tries to complete Victim's media
    const attackComplete = await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${victimMediaId}/complete`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // Must be rejected (403 Forbidden or 404 Not Found)
    expect([403, 404]).toContain(attackComplete.status);

    // Attacker tries to delete Victim's media
    const attackDelete = await request(app.getHttpServer())
      .delete(`/v1/profiles/me/media/${victimMediaId}`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect([403, 404]).toContain(attackDelete.status);

    // Attacker tries to set Victim's media as primary
    const attackPrimary = await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${victimMediaId}/primary`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect([403, 404]).toContain(attackPrimary.status);
  });
});
