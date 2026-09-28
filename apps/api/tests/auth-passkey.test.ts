import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';

describe('Auth: Passkey WebAuthn Flow', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let userAccessToken: string;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);

    // Bootstrap an active user session via email
    const email = 'passkeyuser@example.com';
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    userAccessToken = verifyRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let registeredCredentialId: string;

  it('generates WebAuthn registration options for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/options')
      .set('Authorization', `Bearer ${userAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.challenge).toBeDefined();
    expect(res.body.data.rp.name).toContain('Nazar');
    expect(res.body.data.user.id).toBeDefined();
  });

  it('rejects registration options without authentication', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/passkey/register/options');
    expect(res.status).toBe(401);
  });

  it('verifies registration and creates passkey credential', async () => {
    // 1. Get options
    const optRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/options')
      .set('Authorization', `Bearer ${userAccessToken}`);

    const challenge = optRes.body.data.challenge;
    registeredCredentialId = `cred-${Date.now()}`;
    const publicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0';

    // 2. Verify registration
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/verify')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        challenge,
        credentialId: registeredCredentialId,
        publicKey,
        aaguid: '00000000-0000-0000-0000-000000000000',
      });

    expect([200, 201]).toContain(verifyRes.status);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.credentialId).toBe(registeredCredentialId);

    // 3. Challenge replay must be rejected
    const replayRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/verify')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        challenge,
        credentialId: `cred-replay-${Date.now()}`,
        publicKey,
      });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.success).toBe(false);
  });

  it('completes passkey login flow: options -> verify -> session issued', async () => {
    // 1. Request login options
    const optRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/login/options')
      .send({});

    expect(optRes.status).toBe(200);
    expect(optRes.body.success).toBe(true);
    expect(optRes.body.data.challenge).toBeDefined();
    const challenge = optRes.body.data.challenge;

    // 2. Verify login with the registered credential
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/login/verify')
      .send({
        challenge,
        credentialId: registeredCredentialId,
        device: {
          platform: 'ios',
          deviceModel: 'iPhone 15',
          appVersion: '1.0.0',
        },
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.refreshToken).toBeDefined();
    expect(loginRes.body.data.user.id).toBeDefined();

    // 3. Challenge replay on login must be rejected
    const replayLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/passkey/login/verify')
      .send({
        challenge,
        credentialId: registeredCredentialId,
      });

    expect(replayLoginRes.status).toBe(401);
    expect(replayLoginRes.body.success).toBe(false);
  });
});
