import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AppConfigService } from '../src/config/app-config.service.js';

describe('Auth: Google and Apple OAuth Validation', () => {
  let app: INestApplication;
  let configService: AppConfigService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    configService = app.get(AppConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  function createTestJwt(payload: Record<string, unknown>): string {
    return jwt.sign(payload, 'test-secret', { algorithm: 'HS256' });
  }

  describe('Google OAuth Flow', () => {
    it('authenticates valid Google ID token and issues session tokens', async () => {
      const idToken = createTestJwt({
        iss: 'https://accounts.google.com',
        aud: configService.googleClientId,
        sub: 'google-uid-001',
        email: 'googleuser1@test.com',
        email_verified: true,
        name: 'Google User One',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/oauth/google')
        .send({ idToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects Google token with invalid issuer', async () => {
      const idToken = createTestJwt({
        iss: 'https://evil-issuer.com',
        aud: configService.googleClientId,
        sub: 'google-uid-002',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/oauth/google')
        .send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects Google token with wrong audience', async () => {
      const idToken = createTestJwt({
        iss: 'https://accounts.google.com',
        aud: 'attacker-client-id.apps.googleusercontent.com',
        sub: 'google-uid-003',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/oauth/google')
        .send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired Google token', async () => {
      const idToken = createTestJwt({
        iss: 'https://accounts.google.com',
        aud: configService.googleClientId,
        sub: 'google-uid-004',
        exp: Math.floor(Date.now() / 1000) - 300, // 5 minutes in the past
      });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/oauth/google')
        .send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Apple OAuth Flow', () => {
    it('authenticates valid Apple ID token and issues session tokens', async () => {
      const idToken = createTestJwt({
        iss: 'https://appleid.apple.com',
        aud: configService.appleClientId,
        sub: 'apple-uid-001',
        email: 'appleuser1@test.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer()).post('/v1/auth/oauth/apple').send({ idToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects Apple token with invalid issuer', async () => {
      const idToken = createTestJwt({
        iss: 'https://spoofed.apple.com',
        aud: configService.appleClientId,
        sub: 'apple-uid-002',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer()).post('/v1/auth/oauth/apple').send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects Apple token with wrong audience', async () => {
      const idToken = createTestJwt({
        iss: 'https://appleid.apple.com',
        aud: 'com.anotherapp.client',
        sub: 'apple-uid-003',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app.getHttpServer()).post('/v1/auth/oauth/apple').send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired Apple token', async () => {
      const idToken = createTestJwt({
        iss: 'https://appleid.apple.com',
        aud: configService.appleClientId,
        sub: 'apple-uid-004',
        exp: Math.floor(Date.now() / 1000) - 100,
      });

      const res = await request(app.getHttpServer()).post('/v1/auth/oauth/apple').send({ idToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
