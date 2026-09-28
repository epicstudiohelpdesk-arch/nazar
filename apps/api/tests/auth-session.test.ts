import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Auth: Session Lifecycle, Rotation & Replay Detection', () => {
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

  async function createSession(emailRaw?: string) {
    const email = emailRaw ?? `sess_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id,
      accessToken: res.body.data.accessToken as string,
      refreshToken: res.body.data.refreshToken as string,
    };
  }

  it('rotates refresh token and issues new access token on valid refresh', async () => {
    const session = await createSession();

    const refreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    // Refresh token MUST have rotated to a different cryptographic secret
    expect(refreshRes.body.data.refreshToken).not.toBe(session.refreshToken);
  });

  it('detects refresh token replay and immediately revokes the compromised session', async () => {
    const session = await createSession();

    // 1. Normal legitimate refresh: rotates token from R0 -> R1
    const firstRefreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(firstRefreshRes.status).toBe(200);
    const newRefreshToken = firstRefreshRes.body.data.refreshToken as string;
    const newAccessToken = firstRefreshRes.body.data.accessToken as string;

    // 2. Adversary replays old/rotated token R0
    const replayRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.success).toBe(false);
    expect(replayRes.body.error.code).toBe('TOKEN_REPLAY_DETECTED');

    // 3. Verify breach containment: The entire session is revoked!
    // Even the legitimate newer token R1 must now be rejected!
    const subsequentRefreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken });

    expect(subsequentRefreshRes.status).toBe(401);
    expect(subsequentRefreshRes.body.error.code).toBe('SESSION_REVOKED');

    // The access token for that session must also be rejected by AuthGuard
    const protectedRes = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(protectedRes.status).toBe(401);
    expect(protectedRes.body.error.code).toBe('SESSION_REVOKED');
  });

  it('revokes current session on logout', async () => {
    const session = await createSession();

    // Logout
    const logoutRes = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Refreshing the logged-out session must fail
    const refreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe('SESSION_REVOKED');
  });

  it('revokes all sessions on logout-all', async () => {
    const email = `session4_${generateUuidV7()}@example.com`;
    // Create two separate sessions for the same user
    const sessionA = await createSession(email);
    const sessionB = await createSession(email);

    expect(sessionA.userId).toBe(sessionB.userId);

    // Call logout-all using session A
    const logoutAllRes = await request(app.getHttpServer())
      .post('/v1/auth/logout-all')
      .set('Authorization', `Bearer ${sessionA.accessToken}`);

    expect(logoutAllRes.status).toBe(200);
    expect(logoutAllRes.body.success).toBe(true);

    // Both sessions must now be revoked
    const refreshARes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: sessionA.refreshToken });
    expect(refreshARes.status).toBe(401);
    expect(refreshARes.body.error.code).toBe('SESSION_REVOKED');

    const refreshBRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: sessionB.refreshToken });
    expect(refreshBRes.status).toBe(401);
    expect(refreshBRes.body.error.code).toBe('SESSION_REVOKED');
  });
});
