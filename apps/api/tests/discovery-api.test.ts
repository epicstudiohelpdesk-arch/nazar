import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  profilePreferences,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Discovery: HTTP API Guard & Envelope Validation', () => {
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

  async function createAuthenticatedUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
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

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer()).get('/v1/discovery');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects discovery request if user profile does not exist with 400 PROFILE_NOT_READY', async () => {
    const user = await createAuthenticatedUser('no_profile_user');

    const res = await request(app.getHttpServer())
      .get('/v1/discovery')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.PROFILE_NOT_READY);
  });

  it('rejects discovery request if user profile is DRAFT with 400 PROFILE_NOT_READY', async () => {
    const user = await createAuthenticatedUser('draft_user');
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId: user.userId,
      displayName: 'Draft Guy',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      visibility: 'DRAFT',
      completionStatus: {
        percentage: 50,
        missingRequired: ['PRIMARY_PHOTO'],
        recommended: [],
      },
    });

    const res = await request(app.getHttpServer())
      .get('/v1/discovery')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.PROFILE_NOT_READY);
  });

  it('rejects oversized or invalid limit parameter with 400 DISCOVERY_INVALID_LIMIT', async () => {
    const user = await createAuthenticatedUser('limit_test_user');
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId: user.userId,
      displayName: 'Active Guy',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    // Test limit > 50
    const resOver = await request(app.getHttpServer())
      .get('/v1/discovery?limit=100')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(resOver.status).toBe(400);
    expect(resOver.body.error.code).toBe(ErrorCode.DISCOVERY_INVALID_LIMIT);

    // Test non-integer limit
    const resInvalid = await request(app.getHttpServer())
      .get('/v1/discovery?limit=abc')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.error.code).toBe(ErrorCode.DISCOVERY_INVALID_LIMIT);
  });

  it('rejects malformed or tampered cursor with 400 DISCOVERY_INVALID_CURSOR', async () => {
    const user = await createAuthenticatedUser('cursor_test_user');
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId: user.userId,
      displayName: 'Active Guy',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    const res = await request(app.getHttpServer())
      .get('/v1/discovery?cursor=tampered_cursor_payload_xyz')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.DISCOVERY_INVALID_CURSOR);
  });

  it('returns 200 with canonical success envelope for active user', async () => {
    const user = await createAuthenticatedUser('active_viewer_user');
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId: user.userId,
      displayName: 'Active Viewer',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    await databaseService.client.insert(profilePreferences).values({
      id: generateUuidV7(),
      userId: user.userId,
      minAge: 18,
      maxAge: 40,
      genderPreferences: ['WOMAN'],
      maxDistanceKm: 100,
      relationshipIntent: 'LONG_TERM',
    });

    const res = await request(app.getHttpServer())
      .get('/v1/discovery')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(typeof res.body.data.pagination.hasMore).toBe('boolean');
    expect(res.body.requestId).toBeDefined();
  });
});
