import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { otpChallenges } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe.skip('Auth: Email Passwordless Verification (Removed per OTP backend deprecation)', () => {
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

  const getEmail = () => `email_${generateUuidV7()}@example.com`;

  it('rejects invalid email formats with 400 validation error', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/request-verification')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sends verification code and returns generic anti-enumeration notice for new user', async () => {
    const email = getEmail();
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/request-verification')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe(
      'If the email address is valid, a verification code has been sent.'
    );

    const code = mockEmailProvider.getLastCode(email);
    expect(code).toBeDefined();
    expect(code?.length).toBe(6);
  });

  it('returns identical generic anti-enumeration notice for existing user', async () => {
    const email = getEmail();

    // First request & verify -> creates user
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });
    expect(verifyRes.status).toBe(200);

    // Second request
    const secondReq = await request(app.getHttpServer())
      .post('/v1/auth/email/request-verification')
      .send({ email });

    expect(secondReq.status).toBe(200);
    expect(secondReq.body.data.message).toBe(
      'If the email address is valid, a verification code has been sent.'
    );
  });

  it('verifies valid email code, creates user identity, and issues JWT tokens', async () => {
    const email = getEmail();
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;

    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({
        email,
        code,
        device: {
          platform: 'android',
          deviceModel: 'Pixel 8',
          appVersion: '1.0.0',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.expiresIn).toBe(900);
  });

  it('rejects replayed email verification code (single-use token)', async () => {
    const email = getEmail();
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;

    const firstRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });
    expect(firstRes.status).toBe(200);

    // Replay with consumed code
    const replayRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks out email challenge after exceeding max attempts (5)', async () => {
    const email = getEmail();
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });

    for (let i = 0; i < 5; i++) {
      const wrongRes = await request(app.getHttpServer())
        .post('/v1/auth/email/verify')
        .send({ email, code: '999999' });
      expect(wrongRes.status).toBe(400);
    }

    const lockedRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code: '999999' });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('rejects expired email verification challenge with OTP_EXPIRED', async () => {
    const email = getEmail();
    const id = generateUuidV7();
    const expiredAt = new Date(Date.now() - 60000);

    await databaseService.client.insert(otpChallenges).values({
      id,
      identifier: email,
      identifierType: 'EMAIL',
      otpHash: 'dummy_hash',
      salt: 'dummy_salt',
      expiresAt: expiredAt,
      maxAttempts: 5,
      attemptCount: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });
});
