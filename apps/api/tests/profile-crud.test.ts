import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: CRUD & Age Derivation & PostGIS Coordinates', () => {
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
    const email = `crud_${generateUuidV7()}@example.com`;
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

  it('rejects profile creation for underage user (< 18 years old)', async () => {
    const session = await createSession();
    const today = new Date();
    const underageDob = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate())
      .toISOString()
      .split('T')[0];

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Youngster',
        dateOfBirth: underageDob,
        gender: 'MAN',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects profile creation for invalid date format or future date', async () => {
    const session = await createSession();

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Time Traveler',
        dateOfBirth: '2099-01-01',
        gender: 'NON_BINARY',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates profile with valid data, derives age server-side, and stores PostGIS coordinates', async () => {
    const session = await createSession();
    const birthYear = new Date().getFullYear() - 25;
    const dob = `${birthYear}-05-15`;

    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Aarav Sharma',
        dateOfBirth: dob,
        gender: 'MAN',
        bio: 'Explorer of mountain trails and coffee roasters',
        occupation: 'Software Engineer',
        education: 'B.Tech Computer Science',
        city: 'Bengaluru',
        countryCode: 'IN',
        location: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.displayName).toBe('Aarav Sharma');
    expect(data.dateOfBirth).toBe(dob);
    expect(data.age).toBe(25);
    expect(data.gender).toBe('MAN');
    expect(data.city).toBe('Bengaluru');
    expect(data.visibility).toBe('DRAFT');
    expect(data.location).toBeDefined();
    expect(data.location.latitude).toBeCloseTo(12.9716, 3);
    expect(data.location.longitude).toBeCloseTo(77.5946, 3);
  });

  it('retrieves owner private profile via GET /v1/profiles/me', async () => {
    const session = await createSession();
    const birthYear = new Date().getFullYear() - 28;
    const dob = `${birthYear}-08-20`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Priya Patel',
        dateOfBirth: dob,
        gender: 'WOMAN',
        city: 'Mumbai',
      });

    const res = await request(app.getHttpServer())
      .get('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Priya Patel');
    expect(res.body.data.age).toBe(28);
    expect(res.body.data.dateOfBirth).toBe(dob);
    expect(res.body.data.gender).toBe('WOMAN');
  });

  it('updates profile fields and recalculates completeness score', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 24}-01-01`;

    // 1. Initial minimal profile
    const initialRes = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Rohan',
        dateOfBirth: dob,
        gender: 'MAN',
      });

    const initialScore = initialRes.body.data.completionStatus.percentage;
    expect(initialScore).toBeGreaterThan(0);

    // 2. Add bio, occupation, city
    const updateRes = await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        bio: 'Avid reader and trail runner.',
        occupation: 'Product Designer',
        city: 'San Francisco',
      });

    expect(updateRes.status).toBe(200);
    const updatedScore = updateRes.body.data.completionStatus.percentage;
    expect(updatedScore).toBeGreaterThan(initialScore);
    expect(updateRes.body.data.bio).toBe('Avid reader and trail runner.');
    expect(updateRes.body.data.occupation).toBe('Product Designer');
  });
});
