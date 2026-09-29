import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  notifications,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Notifications Feed: History, Read State, and Expiration', () => {
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
      gender: 'WOMAN',
      city: 'Pune',
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

  it('fetches notifications with cursor pagination and calculates unread count accurately', async () => {
    const user = await createActiveUser('feed_page_user');

    // Seed 5 notifications for user (with 1 second staggered timestamps)
    const baseTime = Date.now() - 10000;
    for (let i = 0; i < 5; i++) {
      await databaseService.client.insert(notifications).values({
        id: generateUuidV7(),
        userId: user.userId,
        type: i % 2 === 0 ? 'NEW_MESSAGE' : 'NEW_MATCH',
        title: `Test Notification #${i}`,
        body: `Body content for item ${i}`,
        priority: 'NORMAL',
        createdAt: new Date(baseTime + i * 1000),
        updatedAt: new Date(baseTime + i * 1000),
      });
    }

    // 1. Fetch first page with limit=2
    const page1Res = await request(app.getHttpServer())
      .get('/v1/notifications?limit=2')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data.items).toHaveLength(2);
    expect(page1Res.body.data.hasMore).toBe(true);
    expect(page1Res.body.data.nextCursor).toBeDefined();
    expect(page1Res.body.data.totalUnreadCount).toBe(5);

    // 2. Fetch second page using nextCursor
    const page2Res = await request(app.getHttpServer())
      .get(`/v1/notifications?limit=2&cursor=${page1Res.body.data.nextCursor}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.items).toHaveLength(2);
    expect(page2Res.body.data.hasMore).toBe(true);

    // Items must not overlap
    const p1Ids = page1Res.body.data.items.map((i: any) => i.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    const p2Ids = page2Res.body.data.items.map((i: any) => i.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(p1Ids.some((id: string) => p2Ids.includes(id))).toBe(false);

    // 3. Check standalone unread-count endpoint
    const unreadRes = await request(app.getHttpServer())
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.data.count).toBe(5);
  });

  it('marks individual notification as read and validates ownership', async () => {
    const userA = await createActiveUser('notif_read_a');
    const userB = await createActiveUser('notif_read_b');

    const notifAId = generateUuidV7();
    await databaseService.client.insert(notifications).values({
      id: notifAId,
      userId: userA.userId,
      type: 'NEW_MATCH',
      title: 'Match for A',
      body: 'Body',
      priority: 'NORMAL',
    });

    // User B attempts to mark User A's notification as read -> 403
    const crossReadRes = await request(app.getHttpServer())
      .post(`/v1/notifications/${notifAId}/read`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(crossReadRes.status).toBe(403);

    // User A marks their own notification as read -> 200
    const ownerReadRes = await request(app.getHttpServer())
      .post(`/v1/notifications/${notifAId}/read`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(ownerReadRes.status).toBe(200);
    expect(ownerReadRes.body.data.id).toBe(notifAId);
    expect(ownerReadRes.body.data.readAt).toBeDefined();

    // Verify DB updated
    const [row] = await databaseService.client
      .select()
      .from(notifications)
      .where(eq(notifications.id, notifAId));

    expect(row?.readAt).not.toBeNull();
  });

  it('marks all unread notifications as read in bulk', async () => {
    const user = await createActiveUser('bulk_read_user');

    for (let i = 0; i < 3; i++) {
      await databaseService.client.insert(notifications).values({
        id: generateUuidV7(),
        userId: user.userId,
        type: 'NEW_LIKE',
        title: `Like #${i}`,
        body: 'Someone liked you',
        priority: 'LOW',
      });
    }

    const bulkRes = await request(app.getHttpServer())
      .post('/v1/notifications/read-all')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data.updatedCount).toBe(3);

    const unreadRes = await request(app.getHttpServer())
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(unreadRes.body.data.count).toBe(0);
  });

  it('omits expired notifications from feed and unread count', async () => {
    const user = await createActiveUser('exp_notif_user');

    // Seed 1 active and 1 expired notification
    const activeId = generateUuidV7();
    const expiredId = generateUuidV7();

    await databaseService.client.insert(notifications).values({
      id: activeId,
      userId: user.userId,
      type: 'NEW_MESSAGE',
      title: 'Active notification',
      body: 'Active body',
      priority: 'NORMAL',
      expiresAt: new Date(Date.now() + 86400000), // +1 day
    });

    await databaseService.client.insert(notifications).values({
      id: expiredId,
      userId: user.userId,
      type: 'NEW_MESSAGE',
      title: 'Expired notification',
      body: 'Expired body',
      priority: 'NORMAL',
      expiresAt: new Date(Date.now() - 3600000), // -1 hour (expired)
    });

    const feedRes = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.items).toHaveLength(1);
    expect(feedRes.body.data.items[0]?.id).toBe(activeId);
    expect(feedRes.body.data.totalUnreadCount).toBe(1);
  });
});
