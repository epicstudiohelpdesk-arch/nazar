import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users, userIdentities } from '../src/infrastructure/database/drizzle/schema/index.js';

describe('Auth: Identifier Existence Check (Anti-Enumeration Guarded)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const testPhone = '+919876543210';
  const testEmail = `user_${Date.now()}@example.com`;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = app.get(DatabaseService);

    // Seed test user with phone and email identities
    const userId = generateUuidV7();
    await db.client.insert(users).values({
      id: userId,
      status: 'ACTIVE',
    });

    await db.client.insert(userIdentities).values([
      {
        id: generateUuidV7(),
        userId,
        provider: 'PHONE',
        providerSubject: testPhone,
        email: testEmail,
        emailVerified: true,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('confirms existing user by phone number', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/check-identifier')
      .send({ identifier: testPhone, type: 'PHONE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(true);
    expect(res.body.data.provider).toBe('PHONE');
  });

  it('confirms existing user by email address', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/check-identifier')
      .send({ identifier: testEmail, type: 'EMAIL' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(true);
  });

  it('returns exists: false for unregistered phone number', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/check-identifier')
      .send({ identifier: '+919111122222', type: 'PHONE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(false);
    expect(res.body.data.provider).toBeUndefined();
  });

  it('rejects invalid or too short identifier with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/check-identifier')
      .send({ identifier: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
