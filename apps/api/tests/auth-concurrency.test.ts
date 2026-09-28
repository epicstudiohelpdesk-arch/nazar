import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';

describe('Auth: Concurrency & Transactional Integrity', () => {
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

  it('handles simultaneous refresh attempts deterministically', async () => {
    const email = `concurrency_${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const initialRefreshToken = verifyRes.body.data.refreshToken;

    // Fire 2 simultaneous refresh requests with the EXACT same refresh token
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken }),
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken }),
    ]);

    // Either both were handled deterministically:
    // One succeeds (200) and the other fails due to token rotation / replay detection (401),
    // OR one revokes the session if detected as replay.
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(401);
  });

  it('handles simultaneous OTP consumption attempts with exactly one winner', async () => {
    const email = `otp_race_${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;

    // Fire 2 simultaneous verify requests with the same single-use code
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).post('/v1/auth/email/verify').send({ email, code }),
      request(app.getHttpServer()).post('/v1/auth/email/verify').send({ email, code }),
    ]);

    const statuses = [res1.status, res2.status];
    // Exactly one should succeed, the other should be rejected
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
  });
});
