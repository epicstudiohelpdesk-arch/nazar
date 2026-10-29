import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp } from '../test-app.helper.js';
import { DatabaseService } from '../../src/infrastructure/database/database.service.js';
import {
  users,
  devices,
  outboxEvents,
  notifications,
  notificationDeliveryJobs,
  entitlements,
  subscriptions,
  products,
} from '../../src/infrastructure/database/drizzle/schema/index.js';
import { NotificationEventConsumer } from '../../src/modules/notifications/workers/notification-event-consumer.js';
import { NotificationDeliveryWorker } from '../../src/modules/notifications/workers/notification-delivery-worker.js';
import { EntitlementExpirationWorker } from '../../src/modules/payments/workers/entitlement-expiration-worker.js';
import { NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN } from '../../src/modules/notifications/repositories/notification-delivery-jobs.repository.interface.js';
import { NOTIFICATIONS_REPOSITORY_TOKEN } from '../../src/modules/notifications/repositories/notifications.repository.interface.js';
import { DEVICES_REPOSITORY_TOKEN } from '../../src/modules/notifications/repositories/devices.repository.interface.js';
import { USER_RESTRICTIONS_REPOSITORY_TOKEN } from '../../src/modules/safety/repositories/user-restrictions.repository.interface.js';
import { AppLoggerService } from '../../src/common/logging/app-logger.service.js';
import { MockPushProvider } from '../../src/modules/notifications/providers/mock-push.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Worker Throughput & Batch Processing Benchmarks (Gate 17)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let consumer: NotificationEventConsumer;
  let deliveryWorker: NotificationDeliveryWorker;
  let expirationWorker: EntitlementExpirationWorker;
  let mockApnsProvider: MockPushProvider;
  let mockFcmProvider: MockPushProvider;

  beforeAll(async () => {
    mockApnsProvider = new MockPushProvider('APNS');
    mockFcmProvider = new MockPushProvider('FCM');

    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    consumer = app.get(NotificationEventConsumer);
    expirationWorker = app.get(EntitlementExpirationWorker);

    deliveryWorker = new NotificationDeliveryWorker(
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

  async function createTestRecipient(tag: string) {
    const userId = generateUuidV7();
    const deviceId = generateUuidV7();

    await databaseService.client.insert(users).values({
      id: userId,
      phoneNumber: `+91987${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: `${tag}_${userId}@example.com`,
      status: 'ACTIVE',
    });

    await databaseService.client.insert(devices).values({
      id: deviceId,
      userId,
      platform: 'IOS',
      pushToken: `apns_token_${deviceId}`,
      appVersion: '1.0.0',
      osVersion: 'iOS 17.0',
    });

    return { userId, deviceId };
  }

  it('measures outbox event consumer processing throughput across 50 pending events', async () => {
    const { userId } = await createTestRecipient('outbox_bench');
    const batchSize = 50;

    // Seed 50 outbox events
    const eventValues = Array.from({ length: batchSize }).map((_, i) => ({
      id: generateUuidV7(),
      eventType: 'match.created',
      aggregateType: 'MATCH',
      aggregateId: generateUuidV7(),
      payload: {
        matchId: generateUuidV7(),
        user1Id: userId,
        user2Id: generateUuidV7(),
      },
      status: 'PENDING' as const,
    }));

    await databaseService.client.insert(outboxEvents).values(eventValues);

    const startTime = performance.now();
    let totalProcessed = 0;
    while (totalProcessed < batchSize) {
      const processed = await consumer.processPendingEvents(25);
      if (processed === 0) break;
      totalProcessed += processed;
    }
    const elapsedMs = performance.now() - startTime;
    const eventsPerSecond = (totalProcessed / (elapsedMs / 1000)).toFixed(1);

    console.log(
      `[Benchmark: Outbox Consumer] Processed ${totalProcessed} events in ${elapsedMs.toFixed(1)}ms (${eventsPerSecond} events/sec)`
    );

    expect(totalProcessed).toBe(batchSize);
    expect(elapsedMs).toBeLessThan(10000); // Must process 50 events well within 10 seconds
  });

  it('measures push notification delivery worker throughput across 50 jobs', async () => {
    const { userId, deviceId } = await createTestRecipient('delivery_bench');
    const batchSize = 50;

    // Seed 50 notifications and delivery jobs
    for (let i = 0; i < batchSize; i++) {
      const notifId = generateUuidV7();
      await databaseService.client.insert(notifications).values({
        id: notifId,
        userId,
        type: 'MATCH_NEW',
        priority: 'DEFAULT',
        title: 'New Match!',
        body: 'You have a new match!',
        data: {},
      });

      await databaseService.client.insert(notificationDeliveryJobs).values({
        id: generateUuidV7(),
        notificationId: notifId,
        userId,
        deviceId,
        provider: 'APNS',
        token: `apns_token_${deviceId}`,
        status: 'PENDING',
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        availableAt: new Date(Date.now() - 1000),
      });
    }

    const startTime = performance.now();
    let totalDelivered = 0;
    while (totalDelivered < batchSize) {
      const delivered = await deliveryWorker.processJobs(25);
      if (delivered === 0) break;
      totalDelivered += delivered;
    }
    const elapsedMs = performance.now() - startTime;
    const jobsPerSecond = (totalDelivered / (elapsedMs / 1000)).toFixed(1);

    console.log(
      `[Benchmark: Delivery Worker] Delivered ${totalDelivered} push jobs in ${elapsedMs.toFixed(1)}ms (${jobsPerSecond} jobs/sec)`
    );

    expect(totalDelivered).toBe(batchSize);
    expect(mockApnsProvider.getSent().length).toBe(batchSize);
    expect(elapsedMs).toBeLessThan(8000); // 50 deliveries in under 8s
  });

  it('measures entitlement expiration sweep throughput across 40 expired items', async () => {
    const { userId } = await createTestRecipient('entitlement_bench');
    const count = 40;
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago

    // Ensure dummy product exists
    const productId = generateUuidV7();
    await databaseService.client
      .insert(products)
      .values({
        id: productId,
        code: `perf_prod_${generateUuidV7().slice(0, 8)}`,
        name: 'Perf Plus',
        description: 'Performance test product',
        productType: 'SUBSCRIPTION',
        status: 'ACTIVE',
        durationDays: 30,
        basePriceMinor: 999,
        baseCurrency: 'USD',
      })
      .onConflictDoNothing();

    // Insert 40 expired entitlements
    const entRows = Array.from({ length: count }).map(() => ({
      id: generateUuidV7(),
      userId,
      entitlementCode: 'UNLIMITED_SWIPES',
      sourceType: 'SUBSCRIPTION',
      sourceId: generateUuidV7(),
      grantedAt: new Date(Date.now() - 86400 * 1000),
      expiresAt: pastDate,
      status: 'ACTIVE',
    }));
    await databaseService.client.insert(entitlements).values(entRows);

    const startTime = performance.now();
    const result = await expirationWorker.processExpirations(new Date());
    const elapsedMs = performance.now() - startTime;
    const rate = (result.expiredEntitlements / (elapsedMs / 1000)).toFixed(1);

    console.log(
      `[Benchmark: Entitlement Expiration Worker] Swept ${result.expiredEntitlements} entitlements in ${elapsedMs.toFixed(1)}ms (${rate} items/sec)`
    );

    expect(result.expiredEntitlements).toBeGreaterThanOrEqual(count);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
