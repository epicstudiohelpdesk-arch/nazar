import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: Media Management, Presigned Uploads & Reordering', () => {
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
    const email = `media_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;

    // Create base profile
    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'PhotoUser',
        dateOfBirth: '1998-04-12',
        gender: 'NON_BINARY',
      });

    return { userId, accessToken };
  }

  it('generates presigned upload URL for valid image mime types and dimensions', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024 * 2, // 2 MB
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.mediaId).toBeDefined();
    expect(data.uploadUrl).toBeDefined();
    expect(data.uploadUrl).toContain('http');
    expect(data.storageKey).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  it('rejects unsupported media formats (e.g. image/gif or application/pdf)', async () => {
    const session = await createSession();

    const gifRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'image/gif',
        sizeBytes: 1024 * 50,
      });

    expect(gifRes.status).toBe(400);

    const pdfRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 50,
      });

    expect(pdfRes.status).toBe(400);
  });

  it('rejects files larger than 15 MB limit', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'image/jpeg',
        sizeBytes: 16 * 1024 * 1024, // 16 MB
      });

    expect(res.status).toBe(400);
  });

  it('completes upload, marks media READY, and designates first photo as primary automatically', async () => {
    const session = await createSession();

    // 1. Request upload
    const uploadRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        mimeType: 'image/png',
        sizeBytes: 1024 * 300,
      });

    const mediaId = uploadRes.body.data.mediaId;

    // 2. Complete upload
    const completeRes = await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${mediaId}/complete`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.id).toBe(mediaId);
    expect(completeRes.body.data.status).toBe('READY');
    expect(completeRes.body.data.isPrimary).toBe(true);
    expect(completeRes.body.data.url).toBeDefined();
  });

  it('manages primary photo selection and photo reordering', async () => {
    const session = await createSession();

    // Upload photo 1
    const p1 = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 200 });
    const id1 = p1.body.data.mediaId;
    await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${id1}/complete`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    // Upload photo 2
    const p2 = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 200 });
    const id2 = p2.body.data.mediaId;
    await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${id2}/complete`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    // Verify photo 1 is primary and photo 2 is not
    const listRes1 = await request(app.getHttpServer())
      .get('/v1/profiles/me/media')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(listRes1.body.data.find((m: any) => m.id === id1).isPrimary).toBe(true);
    expect(listRes1.body.data.find((m: any) => m.id === id2).isPrimary).toBe(false);

    // Set photo 2 as primary
    const setPrimaryRes = await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${id2}/primary`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(setPrimaryRes.status).toBe(200);
    expect(setPrimaryRes.body.data.find((m: any) => m.id === id2).isPrimary).toBe(true);
    expect(setPrimaryRes.body.data.find((m: any) => m.id === id1).isPrimary).toBe(false);

    // Reorder photos [id1, id2]
    const reorderRes = await request(app.getHttpServer())
      .patch('/v1/profiles/me/media/reorder')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ mediaIds: [id1, id2] });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.data[0].id).toBe(id1);
    expect(reorderRes.body.data[1].id).toBe(id2);
  });

  it('enforces maximum 6 photos limit on profile', async () => {
    const session = await createSession();

    // Upload 6 photos
    for (let i = 0; i < 6; i++) {
      const up = await request(app.getHttpServer())
        .post('/v1/profiles/me/media/upload-url')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 100 });
      expect(up.status).toBe(200);
    }

    // 7th upload must fail with MEDIA_LIMIT_REACHED
    const extraRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 100 });

    expect(extraRes.status).toBe(400);
    expect(extraRes.body.error.code).toBe('MEDIA_LIMIT_REACHED');
  });

  it('prevents deleting the only photo while profile is ACTIVE (PRIMARY_MEDIA_REQUIRED)', async () => {
    const session = await createSession();

    // 1. Upload & complete 1 photo
    const up = await request(app.getHttpServer())
      .post('/v1/profiles/me/media/upload-url')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ mimeType: 'image/jpeg', sizeBytes: 1024 * 200 });
    const mediaId = up.body.data.mediaId;
    await request(app.getHttpServer())
      .post(`/v1/profiles/me/media/${mediaId}/complete`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    // Complete remaining fields to activate
    await request(app.getHttpServer())
      .put('/v1/profiles/me/preferences')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ minAge: 20, maxAge: 30, genderPreferences: ['WOMAN'], maxDistanceKm: 40 });

    const interestsRes = await request(app.getHttpServer()).get('/v1/interests');
    const interestIds = interestsRes.body.data.slice(0, 3).map((i: any) => i.id);
    await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ interestIds });

    const promptsRes = await request(app.getHttpServer()).get('/v1/prompts');
    await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        prompts: [
          { promptDefinitionId: promptsRes.body.data[0].id, answerText: 'Hiking in nature.' },
        ],
      });

    // Activate profile
    const actRes = await request(app.getHttpServer())
      .post('/v1/profiles/me/activate')
      .set('Authorization', `Bearer ${session.accessToken}`);
    expect(actRes.status).toBe(200);

    // Attempt to delete only photo while ACTIVE -> must fail with PRIMARY_MEDIA_REQUIRED
    const delRes = await request(app.getHttpServer())
      .delete(`/v1/profiles/me/media/${mediaId}`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(delRes.status).toBe(400);
    expect(delRes.body.error.code).toBe('PRIMARY_MEDIA_REQUIRED');
  });
});
