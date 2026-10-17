import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { MockSmsProvider, SMS_PROVIDER_TOKEN } from '../src/modules/auth/providers/sms.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { otpChallenges } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Auth: Phone OTP Verification', () => {
  let app: INestApplication;
  let mockSmsProvider: MockSmsProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockSmsProvider = app.get<MockSmsProvider>(SMS_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  const getPhone = () => `+1415${Math.floor(1000000 + Math.random() * 9000000)}`;

  it('rejects invalid phone numbers with 400 validation error', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phoneNumber: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sends OTP and returns generic anti-enumeration response for new user', async () => {
    const phoneNumber = getPhone();
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phoneNumber });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe(
      'If the phone number is valid, a verification code has been sent.'
    );

    const otp = mockSmsProvider.getLastOtp(phoneNumber);
    expect(otp).toBeDefined();
    expect(otp?.length).toBe(6);
  });

  it('returns identical anti-enumeration response for existing user', async () => {
    const phoneNumber = getPhone();

    // First request - user will be created on verify
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });
    const otp1 = mockSmsProvider.getLastOtp(phoneNumber)!;

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code: otp1 });
    expect(verifyRes.status).toBe(200);

    // Second request - user already exists
    const secondReqRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phoneNumber });

    expect(secondReqRes.status).toBe(200);
    expect(secondReqRes.body.data.message).toBe(
      'If the phone number is valid, a verification code has been sent.'
    );
  });

  it('verifies valid OTP, creates user, session, and returns access + refresh tokens', async () => {
    const phoneNumber = getPhone();
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });
    const otp = mockSmsProvider.getLastOtp(phoneNumber)!;

    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({
        phoneNumber,
        code: otp,
        device: {
          platform: 'ios',
          deviceModel: 'iPhone 15 Pro',
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

  it('prevents OTP replay consumption (single-use token security)', async () => {
    const phoneNumber = getPhone();
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });
    const otp = mockSmsProvider.getLastOtp(phoneNumber)!;

    // First verify succeeds
    const firstRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code: otp });
    expect(firstRes.status).toBe(200);

    // Second verify with same OTP MUST be rejected
    const replayRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code: otp });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.success).toBe(false);
    expect(replayRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks out OTP challenge after exceeding max attempts (5)', async () => {
    const phoneNumber = getPhone();
    await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ phoneNumber });

    // Send 5 incorrect codes
    for (let i = 0; i < 5; i++) {
      const wrongRes = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .send({ phoneNumber, code: '000000' });
      expect(wrongRes.status).toBe(400);
    }

    // 6th attempt should be rejected with TOO_MANY_ATTEMPTS
    const lockedRes = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code: '000000' });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('rejects expired OTP challenge with OTP_EXPIRED', async () => {
    const phoneNumber = getPhone();
    const id = generateUuidV7();
    const expiredAt = new Date(Date.now() - 60000);

    await databaseService.client.insert(otpChallenges).values({
      id,
      identifier: phoneNumber,
      identifierType: 'PHONE',
      otpHash: 'dummy_hash',
      salt: 'dummy_salt',
      expiresAt: expiredAt,
      maxAttempts: 5,
      attemptCount: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phoneNumber, code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });
});
