import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { EMAIL_PROVIDER_TOKEN } from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

// Gate 1A change (intentional, documented): the previous suite asserted the
// INSECURE legacy behavior — registering a passkey with a client-fabricated
// public key and "logging in" with no assertion verification (Gate 0 finding
// C-2). Those positive assertions were replaced with negative security
// assertions: while passkeys are disabled (the default everywhere), every
// endpoint must fail closed and never issue a session. Real WebAuthn
// verification ships in Gate 1B.
describe('Auth: Passkey (Gate 1A fail-closed while unverified)', () => {
  let app: INestApplication;
  let userAccessToken: string;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    const mockEmailProvider = app.get<never>(EMAIL_PROVIDER_TOKEN);
    const email = `passkey_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = (mockEmailProvider as unknown as { getLastCode(e: string): string }).getLastCode(
      email
    );
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });
    userAccessToken = verifyRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('still requires authentication for registration options (guard intact)', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/passkey/register/options');
    expect(res.status).toBe(401);
  });

  it('rejects registration options with 503 while passkeys are disabled', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/options')
      .set('Authorization', `Bearer ${userAccessToken}`);
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it('rejects registration verification with 503 (no credential stored)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/passkey/register/verify')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        challenge: 'x',
        id: 'forged',
        rawId: 'forged',
        type: 'public-key',
        response: {
          clientDataJSON: 'Zm9yZ2Vk',
          attestationObject: 'Zm9yZ2Vk',
        },
      });
    expect(res.status).toBe(503);
  });

  it('rejects login options with 503 while passkeys are disabled', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/passkey/login/options').send({});
    expect(res.status).toBe(503);
  });

  it('never issues a session from an unverified assertion (login verify 503)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/passkey/login/verify')
      .send({
        challenge: 'x',
        id: 'forged',
        rawId: 'forged',
        type: 'public-key',
        response: {
          clientDataJSON: 'Zm9yZ2Vk',
          authenticatorData: 'Zm9yZ2Vk',
          signature: 'Zm9yZ2Vk',
        },
      });
    expect(res.status).toBe(503);
    expect(res.body?.data?.accessToken).toBeUndefined();
  });
});
