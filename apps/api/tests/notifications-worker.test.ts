import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  users,
  devices,
  matches,
  outboxEvents,
  notifications,
  notificationDeliveryJobs,
  notificationPreferences,
  userBlocks,
  userRestrictions,
  conversations,
  conversationReadStates,
  securityEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { NotificationEventConsumer } from '../src/modules/notifications/workers/notification-event-consumer.js';
import { NotificationDeliveryWorker } from '../src/modules/notifications/workers/notification-delivery-worker.js';
import { NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/notification-delivery-jobs.repository.interface.js';
import { NOTIFICATIONS_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/notifications.repository.interface.js';
import { DEVICES_REPOSITORY_TOKEN } from '../src/modules/notifications/repositories/devices.repository.interface.js';
import { USER_RESTRICTIONS_REPOSITORY_TOKEN } from '../src/modules/safety/repositories/user-restrictions.repository.interface.js';
import { AppLoggerService } from '../src/common/logging/app-logger.service.js';
import { MockPushProvider } from '../src/modules/notifications/providers/mock-push.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Notifications Worker & Push Delivery Pipeline', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let consumer: NotificationEventConsumer;
  let worker: NotificationDeliveryWorker;
  let mockApnsProvider: MockPushProvider;
  let mockFcmProvider: MockPushProvider;

  beforeAll(async () => {
    mockApnsProvider = new MockPushProvider('APNS');
    mockFcmProvider = new MockPushProvider('FCM');

    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    consumer = app.get(NotificationEventConsumer);

    // Create delivery worker instance with mock providers injected
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
    await databaseService.client
      .delete(notificationDeliveryJobs);
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

  it('transforms message.created outbox event into durable notification and device delivery jobs', async () => {
    const senderId = await seedTestUser('msg_snd_1');
    const recipientId = await seedTestUser('msg_rcp_1');
    await registerUserDevice(recipientId, 'IOS', 'apns_valid_token_rcp_1');

    const outboxId = generateUuidV7();
    const messageId = generateUuidV7();
    const conversationId = generateUuidV7();

    // 1. Insert message.created outbox event
    await databaseService.client.insert(outboxEvents).values({
      id: outboxId,
      eventType: 'message.created',
      aggregateType: 'MESSAGE',
      aggregateId: messageId,
      payload: {
        messageId,
        conversationId,
        senderUserId: senderId,
        recipientUserId: recipientId,
        body: 'Hello there!',
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    // 2. Run consumer
    const processed = await consumer.processPendingEvents(10);
    expect(processed).toBeGreaterThanOrEqual(1);

    // Verify outbox status is PUBLISHED
    const [ev] = await databaseService.client
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, outboxId));
    if (ev?.lastError) {
      console.log('TEST 1 LAST ERROR:', ev.lastError);
    }
    expect(ev?.status).toBe('PUBLISHED');

    // Verify durable notification created
    const [notif] = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    expect(notif).toBeDefined();
    expect(notif?.type).toBe('NEW_MESSAGE');
    expect((notif?.data as any).conversationId).toBe(conversationId); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Verify delivery job queued
    const jobs = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.notificationId, notif!.id));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe('PENDING');

    // 3. Run delivery worker to dispatch push
    const deliveredCount = await worker.processJobs(10);
    expect(deliveredCount).toBeGreaterThanOrEqual(1);

    // Verify mock APNs provider received the push
    expect(mockApnsProvider.getSent()).toHaveLength(1);
    expect(mockApnsProvider.getLastSent()?.token).toBe('apns_valid_token_rcp_1');

    // Verify delivery job is marked SENT
    const [jobAfter] = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.id, jobs[0]!.id));

    expect(jobAfter?.status).toBe('SENT');
    expect(jobAfter?.providerMessageId).toBeDefined();
  });

  it('guarantees idempotency: duplicate outbox processing does not create duplicate notifications or jobs', async () => {
    const senderId = await seedTestUser('dedup_snd');
    const recipientId = await seedTestUser('dedup_rcp');
    await registerUserDevice(recipientId, 'ANDROID', 'fcm_token_dedup');

    const outboxId = generateUuidV7();
    const messageId = generateUuidV7();

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
        body: 'Idempotency test',
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    // Run consumer once
    await consumer.processPendingEvents(10);

    // Reset outbox event back to PENDING to simulate retry
    await databaseService.client
      .update(outboxEvents)
      .set({ status: 'PENDING', availableAt: new Date(Date.now() - 5000) })
      .where(eq(outboxEvents.id, outboxId));

    // Run consumer a second time
    await consumer.processPendingEvents(10);

    // There must still be EXACTLY 1 notification row for this (outboxId, recipientId, type)
    const notifs = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    expect(notifs).toHaveLength(1);

    // Exactly 1 delivery job
    const jobs = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.notificationId, notifs[0]!.id));

    expect(jobs).toHaveLength(1);
  });

  it('fans out to multiple active devices for a single recipient', async () => {
    const senderId = await seedTestUser('fanout_snd');
    const recipientId = await seedTestUser('fanout_rcp');

    // Register 2 devices (iPhone and Android)
    await registerUserDevice(recipientId, 'IOS', 'apns_fanout_dev1');
    await registerUserDevice(recipientId, 'ANDROID', 'fcm_fanout_dev2');

    const outboxId = generateUuidV7();
    await databaseService.client.insert(outboxEvents).values({
      id: outboxId,
      eventType: 'message.created',
      aggregateType: 'MESSAGE',
      aggregateId: generateUuidV7(),
      payload: {
        messageId: generateUuidV7(),
        conversationId: generateUuidV7(),
        senderUserId: senderId,
        recipientUserId: recipientId,
        body: 'Multi-device fanout',
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    await consumer.processPendingEvents(10);

    const [notif] = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    const jobs = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.notificationId, notif!.id));

    // Exactly 2 delivery jobs
    expect(jobs).toHaveLength(2);

    // Run delivery worker
    await worker.processJobs(10);

    // APNs provider got 1, FCM provider got 1
    expect(mockApnsProvider.getSent()).toHaveLength(1);
    expect(mockFcmProvider.getSent()).toHaveLength(1);
  });

  it('handles stale message race condition (Section 29): suppresses push if message already read', async () => {
    const senderId = await seedTestUser('stale_snd');
    const recipientId = await seedTestUser('stale_rcp');
    await registerUserDevice(recipientId, 'IOS', 'apns_stale_token');

    const outboxId = generateUuidV7();
    const messageId = generateUuidV7();
    const conversationId = generateUuidV7();

    // User already read this message!
    const matchId = generateUuidV7();
    await databaseService.client.insert(matches).values({
      id: matchId,
      userAId: senderId,
      userBId: recipientId,
      status: 'ACTIVE',
    });

    await databaseService.client.insert(conversations).values({
      id: conversationId,
      matchId,
      status: 'ACTIVE',
    });

    await databaseService.client.insert(conversationReadStates).values({
      conversationId,
      userId: recipientId,
      lastReadMessageId: messageId,
      lastReadAt: new Date(),
    });

    await databaseService.client.insert(outboxEvents).values({
      id: outboxId,
      eventType: 'message.created',
      aggregateType: 'MESSAGE',
      aggregateId: messageId,
      payload: {
        messageId,
        conversationId,
        senderUserId: senderId,
        recipientUserId: recipientId,
        body: 'Already read message',
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    await consumer.processPendingEvents(10);

    // No notification should be created
    const notifs = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    expect(notifs).toHaveLength(0);
  });

  it('suppresses push delivery when interpersonal relationship is blocked (Gate 09 integration)', async () => {
    const senderId = await seedTestUser('blk_snd');
    const recipientId = await seedTestUser('blk_rcp');
    await registerUserDevice(recipientId, 'IOS', 'apns_blocked_token');

    // Recipient has blocked sender!
    await databaseService.client.insert(userBlocks).values({
      id: generateUuidV7(),
      blockerUserId: recipientId,
      blockedUserId: senderId,
    });

    const outboxId = generateUuidV7();
    await databaseService.client.insert(outboxEvents).values({
      id: outboxId,
      eventType: 'message.created',
      aggregateType: 'MESSAGE',
      aggregateId: generateUuidV7(),
      payload: {
        messageId: generateUuidV7(),
        conversationId: generateUuidV7(),
        senderUserId: senderId,
        recipientUserId: recipientId,
        body: 'Attempt to reach blocked user',
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    await consumer.processPendingEvents(10);

    const notifs = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    expect(notifs).toHaveLength(0);
  });

  it('suppresses push delivery when user preference disables notification category', async () => {
    const senderId = await seedTestUser('pref_snd');
    const recipientId = await seedTestUser('pref_rcp');
    await registerUserDevice(recipientId, 'IOS', 'apns_pref_token');

    // Disable like notifications in preferences
    await databaseService.client.insert(notificationPreferences).values({
      id: generateUuidV7(),
      userId: recipientId,
      likeNotificationsEnabled: false,
    });

    const outboxId = generateUuidV7();
    await databaseService.client.insert(outboxEvents).values({
      id: outboxId,
      eventType: 'interaction.liked',
      aggregateType: 'INTERACTION',
      aggregateId: generateUuidV7(),
      payload: {
        actorUserId: senderId,
        targetUserId: recipientId,
      },
      status: 'PENDING',
      availableAt: new Date(Date.now() - 5000),
    });

    await consumer.processPendingEvents(10);

    const notifs = await databaseService.client
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, recipientId), eq(notifications.sourceEventId, outboxId)));

    expect(notifs).toHaveLength(0);
  });

  it('handles invalid token errors by revoking device token and emitting security audit event', async () => {
    const userId = await seedTestUser('inv_tok_user');
    const deviceId = await registerUserDevice(userId, 'IOS', 'apns_invalid_token_dead_device');

    const notifId = generateUuidV7();
    await databaseService.client.insert(notifications).values({
      id: notifId,
      userId,
      type: 'NEW_MATCH',
      title: 'Match',
      body: 'You have a match',
      priority: 'NORMAL',
    });

    const jobId = generateUuidV7();
    await databaseService.client.insert(notificationDeliveryJobs).values({
      id: jobId,
      notificationId: notifId,
      deviceId,
      provider: 'APNS',
      status: 'PENDING',
    });

    // Run delivery worker (mockApnsProvider returns TOKEN_INVALID for tokens containing 'invalid')
    await worker.processJobs(10);

    // Job must be permanently marked FAILED
    const [job] = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.id, jobId));

    expect(job?.status).toBe('FAILED');
    expect(job?.lastErrorCode).toBe('TOKEN_INVALID');

    // Device token must be revoked!
    const [deviceRow] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId));

    expect(deviceRow?.revokedAt).not.toBeNull();

    // Security event emitted
    const [secEvent] = await databaseService.client
      .select()
      .from(securityEvents)
      .where(and(eq(securityEvents.userId, userId), eq(securityEvents.eventType, 'device.token.invalidated')));

    expect(secEvent).toBeDefined();
  });

  it('handles retryable timeout errors with exponential backoff', async () => {
    const userId = await seedTestUser('retry_tok_user');
    const deviceId = await registerUserDevice(userId, 'IOS', 'apns_timeout_token_test');

    const notifId = generateUuidV7();
    await databaseService.client.insert(notifications).values({
      id: notifId,
      userId,
      type: 'NEW_MESSAGE',
      title: 'Message',
      body: 'Test',
      priority: 'NORMAL',
    });

    const jobId = generateUuidV7();
    await databaseService.client.insert(notificationDeliveryJobs).values({
      id: jobId,
      notificationId: notifId,
      deviceId,
      provider: 'APNS',
      status: 'PENDING',
      attemptCount: 0,
    });

    await worker.processJobs(10);

    const [job] = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.id, jobId));

    expect(job?.status).toBe('RETRYING');
    expect(job?.attemptCount).toBe(1);
    expect(job?.lastErrorCode).toBe('TIMEOUT');
    expect(job?.nextAttemptAt).toBeDefined();
  });

  it('recovers stuck jobs from crashed workers past lease timeout', async () => {
    const userId = await seedTestUser('crash_tok_user');
    const deviceId = await registerUserDevice(userId, 'IOS', 'apns_valid_token_recovered');

    const notifId = generateUuidV7();
    await databaseService.client.insert(notifications).values({
      id: notifId,
      userId,
      type: 'SYSTEM_NOTICE',
      title: 'Notice',
      body: 'Important notice',
      priority: 'HIGH',
    });

    const jobId = generateUuidV7();
    // Simulate crashed worker: job locked 10 minutes ago
    await databaseService.client.insert(notificationDeliveryJobs).values({
      id: jobId,
      notificationId: notifId,
      deviceId,
      provider: 'APNS',
      status: 'PROCESSING',
      lockedAt: new Date(Date.now() - 10 * 60 * 1000), // -10 min
      lockedBy: 'crashed-worker-dead',
    });

    // Delivery worker should reclaim and process it
    await worker.processJobs(10);

    const [job] = await databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.id, jobId));

    expect(job?.status).toBe('SENT');
  });
});
