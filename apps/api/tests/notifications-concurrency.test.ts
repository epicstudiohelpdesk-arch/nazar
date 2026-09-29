import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  users,
  devices,
  outboxEvents,
  notifications,
  notificationDeliveryJobs,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { NotificationEventConsumer } from '../src/modules/notifications/workers/notification-event-consumer.js';
import { NotificationDeliveryWorker } from '../src/modules/notifications/workers/notification-delivery-worker.js';
import { NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/notification-delivery-jobs.repository.interface.js';
import { NOTIFICATIONS_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/notifications.repository.interface.js';
import { DEVICES_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/devices.repository.interface.js';
import { USER_RESTRICTIONS_REPOSITORY_TOKEN } from '../src/modules/safety/repositories/user-restrictions.repository.interface.js';
import { AppLoggerService } from '../src/common/logging/app-logger.service.js';
import { MockPushProvider } from '../src/modules/notifications/providers/mock-push.provider.js';
import { DevicesService } from '../src/modules/notifications/services/devices.service.js';
import { generateUuidV7 } from '@platform/domain';

describe('Notifications Concurrency & Lock Safety (Gate 10)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let consumer: NotificationEventConsumer;
  let worker: NotificationDeliveryWorker;
  let devicesService: DevicesService;
  let mockApnsProvider: MockPushProvider;
  let mockFcmProvider: MockPushProvider;

  beforeAll(async () => {
    mockApnsProvider = new MockPushProvider('APNS');
    mockFcmProvider = new MockPushProvider('FCM');

    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    consumer = app.get(NotificationEventConsumer);
    devicesService = app.get(DevicesService);

    worker = new NotificationDeliveryWorker(
      app.get(NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN),
      app.get(NOTIFICATIONS_REPOSITORY_TOKEN),
      app.get(DEVICES_REPOSITORY_TOKEN),
      mockApnsProvider,
      mockFcmProvider,
      app.get(USER_RESTRICTIONS_REPOSITORY_TOKEN),
      databaseService,
      app.get(AppLoggerService)
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    mockApnsProvider.clear();
    mockFcmProvider.clear();
    await databaseService.client
      .update(outboxEvents)
      .set({ status: 'PUBLISHED' })
      .where(eq(outboxEvents.status, 'PENDING'));
    await databaseService.client.delete(notificationDeliveryJobs);
  });

  async function seedTestUser(prefix: string) {
    const userId = generateUuidV7();
    await databaseService.client.insert(users).values({
      id: userId,
      phoneNumber: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
      email: `${prefix}_${userId}@example.com`,
      status: 'ACTIVE',
    });
    return userId;
  }

  async function registerUserDevice(userId: string, platform: 'IOS' | 'ANDROID', token: string) {
    const deviceId = generateUuidV7();
    await databaseService.client.insert(devices).values({
      id: deviceId,
      userId,
      platform,
      pushProvider: platform === 'ANDROID' ? 'FCM' : 'APNS',
      pushToken: token,
      deviceIdentifier: `hw-${deviceId}`,
      lastSeenAt: new Date(),
    });
    return deviceId;
  }

  it('guarantees FOR UPDATE SKIP LOCKED isolation: concurrent outbox consumers create zero duplicate notifications', async () => {
    const senderId = await seedTestUser('concur_snd');
    const recipientId = await seedTestUser('concur_rcp');
    await registerUserDevice(recipientId, 'IOS', 'apns_concur_tok_1');

    const eventIds: string[] = [];
    const eventCount = 5;

    // Insert 5 message.created events
    for (let i = 0; i < eventCount; i++) {
      const outboxId = generateUuidV7();
      const messageId = generateUuidV7();
      eventIds.push(outboxId);

      await databaseService.client.insert(outboxEvents).values({
        id: outboxId,
        eventType: 'message.created',
        aggregateType: 'MESSAGE',
        aggregateId: messageId,
        payload: {
          messageId,
          conversationId: generateUuidV7(),
          senderUserId: senderId,
          recipientUserId: recipientId,
          body: `Concurrent message ${i}`,
        },
        status: 'PENDING',
        availableAt: new Date(Date.now() - 5000),
      });
    }

    // Run 5 consumers simultaneously
    const results = await Promise.all([
      consumer.processPendingEvents(10),
      consumer.processPendingEvents(10),
      consumer.processPendingEvents(10),
      consumer.processPendingEvents(10),
      consumer.processPendingEvents(10),
    ]);

    const totalProcessed = results.reduce((acc, count) => acc + count, 0);
    expect(totalProcessed).toBe(eventCount);

    // Verify all 5 outbox events are PUBLISHED
    const updatedEvents = await databaseService.client
      .select()
      .from(outboxEvents)
      .where(inArray(outboxEvents.id, eventIds));

    expect(updatedEvents).toHaveLength(eventCount);
    for (const ev of updatedEvents) {
      expect(ev.status).toBe('PUBLISHED');
    }

    // Verify exactly 5 notifications created (1 per event)
    const notifs = await databaseService.client
      .select()
      .from(notifications)
      .where(inArray(notifications.sourceEventId, eventIds));

    expect(notifs).toHaveLength(eventCount);

    // Verify exactly 5 delivery jobs queued
    const notifIds = notifs.map((n) => n.id);
    const jobs = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(inArray(notificationDeliveryJobs.notificationId, notifIds));

    expect(jobs).toHaveLength(eventCount);
  });

  it('guarantees FOR UPDATE SKIP LOCKED isolation: concurrent delivery workers dispatch zero duplicate push payloads', async () => {
    const userId = await seedTestUser('concur_dlv_user');
    const deviceId = await registerUserDevice(userId, 'IOS', 'apns_concur_dlv_tok');

    const jobCount = 10;
    const notifIds: string[] = [];
    const jobIds: string[] = [];

    for (let i = 0; i < jobCount; i++) {
      const notifId = generateUuidV7();
      notifIds.push(notifId);
      await databaseService.client.insert(notifications).values({
        id: notifId,
        userId,
        type: 'NEW_MATCH',
        title: `Match ${i}`,
        body: 'You have a match',
        priority: 'NORMAL',
      });

      const jobId = generateUuidV7();
      jobIds.push(jobId);
      await databaseService.client.insert(notificationDeliveryJobs).values({
        id: jobId,
        notificationId: notifId,
        deviceId,
        provider: 'APNS',
        status: 'PENDING',
        attemptCount: 0,
      });
    }

    // Run 5 delivery workers concurrently
    const workerPromises = [
      worker.processJobs(10),
      worker.processJobs(10),
      worker.processJobs(10),
      worker.processJobs(10),
      worker.processJobs(10),
    ];

    const dispatchCounts = await Promise.all(workerPromises);
    const totalDispatched = dispatchCounts.reduce((acc, count) => acc + count, 0);

    expect(totalDispatched).toBe(jobCount);

    // Check provider got EXACTLY jobCount pushes (no duplicate dispatches)
    expect(mockApnsProvider.getSent()).toHaveLength(jobCount);

    // Check all jobs reached SENT
    const completedJobs = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(inArray(notificationDeliveryJobs.id, jobIds));

    expect(completedJobs).toHaveLength(jobCount);
    for (const job of completedJobs) {
      expect(job.status).toBe('SENT');
      expect(job.providerMessageId).toBeDefined();
    }
  });

  it('atomically revokes previous device registration when hardware identifier re-registered by new user', async () => {
    const userA = await seedTestUser('reassign_a');
    const userB = await seedTestUser('reassign_b');
    const sharedHardwareId = `hw-shared-${generateUuidV7()}`;

    // User A registers the device
    const deviceA = await devicesService.registerDevice(userA, {
      platform: 'IOS',
      pushToken: 'apns_tok_reassign_user_a',
      deviceIdentifier: sharedHardwareId,
      deviceName: 'Shared iPhone',
    });

    expect(deviceA.userId).toBe(userA);
    expect(deviceA.revokedAt).toBeNull();

    // User B now registers the same physical hardware identifier
    const deviceB = await devicesService.registerDevice(userB, {
      platform: 'IOS',
      pushToken: 'apns_tok_reassign_user_b',
      deviceIdentifier: sharedHardwareId,
      deviceName: 'Shared iPhone (B)',
    });

    expect(deviceB.userId).toBe(userB);
    expect(deviceB.revokedAt).toBeNull();

    // Verify User A's device registration is now revoked
    const [revokedDeviceA] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, deviceA.id));

    expect(revokedDeviceA?.revokedAt).not.toBeNull();
  });
});
