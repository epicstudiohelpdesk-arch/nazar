import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { otpChallenges } from '../src/infrastructure/database/drizzle/schema/index.js';

describe('Auth: AuthGuard & Principal Resolution', () => {
  let app: INestApplication;
  let configService: AppConfigService;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    configService = app.get(AppConfigService);
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createValidSession(email: string) {
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

  it('allows access to public routes without Authorization header', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects access to protected route when Authorization header is missing', async () => {
    const res = await request(app.getHttpServer()).get('/test/protected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects malformed or invalid Bearer tokens', async () => {
    const res = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', 'Bearer invalid.jwt.structure');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects expired access token with TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      {
        sub: generateUuidV7(),
        sid: generateUuidV7(),
        exp: Math.floor(Date.now() / 1000) - 300,
        iss: configService.jwtIssuer,
        aud: configService.jwtAudience,
      },
      configService.jwtAccessSecret
    );

    const res = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects valid JWT if associated session is not found in database', async () => {
    const orphanedToken = jwt.sign(
      {
        sub: generateUuidV7(),
        sid: generateUuidV7(), // Non-existent session
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: configService.jwtIssuer,
        aud: configService.jwtAudience,
      },
      configService.jwtAccessSecret
    );

    const res = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${orphanedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('authenticates valid session and resolves @CurrentUser() principal', async () => {
    const session = await createValidSession(`guard_${Date.now()}@example.com`);

    const res = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.userId).toBe(session.userId);
    expect(res.body.data.user.sessionId).toBeDefined();
  });
});
