import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { profiles } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Notifications & Preferences: User Settings Lifecycle', () => {
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

  async function createActiveUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1998-05-15',
      gender: 'MAN',
      city: 'Delhi',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    return { userId, profileId, accessToken };
  }

  it('automatically initializes safe server-side defaults on first retrieval', async () => {
    const user = await createActiveUser('pref_defaults');

    const res = await request(app.getHttpServer())
      .get('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matchNotificationsEnabled).toBe(true);
    expect(res.body.data.messageNotificationsEnabled).toBe(true);
    expect(res.body.data.likeNotificationsEnabled).toBe(true);
    expect(res.body.data.safetyNotificationsEnabled).toBe(true);
    expect(res.body.data.systemNotificationsEnabled).toBe(true);
    expect(res.body.data.messagePreviewEnabled).toBe(false); // safe default: preview disabled
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('partially updates notification preferences without modifying unspecified fields', async () => {
    const user = await createActiveUser('pref_update');

    // Update only likeNotificationsEnabled and messagePreviewEnabled
    const patchRes = await request(app.getHttpServer())
      .patch('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        likeNotificationsEnabled: false,
        messagePreviewEnabled: true,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.likeNotificationsEnabled).toBe(false);
    expect(patchRes.body.data.messagePreviewEnabled).toBe(true);
    expect(patchRes.body.data.matchNotificationsEnabled).toBe(true);
    expect(patchRes.body.data.messageNotificationsEnabled).toBe(true);

    // Verify subsequent GET reflects the change
    const getRes = await request(app.getHttpServer())
      .get('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(getRes.body.data.likeNotificationsEnabled).toBe(false);
    expect(getRes.body.data.messagePreviewEnabled).toBe(true);
  });

  it('rejects unexpected or arbitrary preference keys with validation error', async () => {
    const user = await createActiveUser('pref_invalid');

    const res = await request(app.getHttpServer())
      .patch('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        arbitraryKey: true,
        hackSecurity: 'yes',
      });

    expect(res.status).toBe(400);
  });

  it('enforces isolated user preference boundaries across accounts', async () => {
    const userA = await createActiveUser('iso_pref_a');
    const userB = await createActiveUser('iso_pref_b');

    // User A disables match notifications
    await request(app.getHttpServer())
      .patch('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ matchNotificationsEnabled: false });

    // User B's preferences must remain enabled
    const resB = await request(app.getHttpServer())
      .get('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(resB.body.data.matchNotificationsEnabled).toBe(true);
  });
});
