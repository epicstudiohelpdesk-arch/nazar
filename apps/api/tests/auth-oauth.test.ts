import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { generateUuidV7 } from '@platform/domain';

// Gate 1A change (intentional, documented): the previous suite asserted the
// INSECURE legacy behavior — a locally self-signed JWT with arbitrary claims
// was accepted by /v1/auth/oauth/* because the providers only decoded tokens
// without verifying signatures (Gate 0 finding C-1). Those positive
// assertions were replaced with negative security assertions: OAuth
// federation is disabled by default and must fail closed with 503, never
// issuing a session from an unverified token. JWKS signature verification
// ships in Gate 1B; claim-validation tests return with that gate.
describe('Auth: Google/Apple OAuth (Gate 1A fail-closed while unverified)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  function selfSignedGoogleJwt(): string {
    return jwt.sign(
      {
        iss: 'https://accounts.google.com',
        aud: '929075066798-o6qemj04rnrrlm870fgm43jfif4pp8cj.apps.googleusercontent.com',
        sub: generateUuidV7(),
        exp: Math.floor(Date.now() / 1000) + 300,
        email: `attacker-${Date.now()}@example.com`,
        email_verified: true,
      },
      'attacker-controlled-key',
      { algorithm: 'HS256' }
    );
  }

  it('rejects Google OAuth with 503 and issues NO session for a forged ID token', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/oauth/google')
      .send({ idToken: selfSignedGoogleJwt() });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body?.data?.accessToken).toBeUndefined();
  });

  it('rejects Apple OAuth with 503 and issues NO session for a forged ID token', async () => {
    const idToken = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: 'com.nazar.app',
        sub: generateUuidV7(),
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      'attacker-controlled-key',
      { algorithm: 'HS256' }
    );

    const res = await request(app.getHttpServer()).post('/v1/auth/oauth/apple').send({ idToken });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body?.data?.accessToken).toBeUndefined();
  });

  it('Firebase login (real signature verification) remains operational', async () => {
    // Firebase is NOT disabled: it performs genuine verification via
    // firebase-admin verifyIdToken. A garbage token must be rejected by that
    // verification (not by a kill switch), proving the path stays active.
    const res = await request(app.getHttpServer())
      .post('/v1/auth/firebase')
      .send({ idToken: 'garbage.forged.token' });

    expect(res.status).toBe(401);
  });
});
