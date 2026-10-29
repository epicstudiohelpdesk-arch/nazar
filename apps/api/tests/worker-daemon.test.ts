import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { WorkerDaemonService } from '../src/modules/workers/worker-daemon.service.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { outboxEvents } from '../src/infrastructure/database/drizzle/schema/outbox-events.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

describe('SEC-03: Background Worker Daemon Subsystem', () => {
  let app: INestApplication;
  let daemonService: WorkerDaemonService;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    daemonService = app.get(WorkerDaemonService);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    if (daemonService.isRunning) {
      await daemonService.stop();
    }
    await app.close();
  });

  it('initializes in stopped state and maintains zero or initial metrics', () => {
    expect(daemonService.isRunning).toBe(false);
    expect(daemonService.currentMetrics.ticks).toBeGreaterThanOrEqual(0);
    expect(daemonService.currentMetrics.errors).toBe(0);
  });

  it('starts and stops gracefully without throwing or leaving dangling timers', async () => {
    await daemonService.start();
    expect(daemonService.isRunning).toBe(true);

    // Allow daemon to run for a short duration
    await new Promise((resolve) => setTimeout(resolve, 150));

    await daemonService.stop();
    expect(daemonService.isRunning).toBe(false);

    const metricsAfterStop = daemonService.currentMetrics;
    expect(metricsAfterStop.ticks).toBeGreaterThanOrEqual(1);

    // Wait further to confirm no new ticks occur after stopping
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(daemonService.currentMetrics.ticks).toBe(metricsAfterStop.ticks);
  });

  it('drains pending outbox events on a single tick execution', async () => {
    const testEventId = generateUuidV7();
    const testUserId = generateUuidV7();

    // Insert pending outbox event
    await databaseService.client.insert(outboxEvents).values({
      id: testEventId,
      eventType: 'chat.message.sent',
      aggregateType: 'CONVERSATION',
      aggregateId: generateUuidV7(),
      payload: {
        messageId: generateUuidV7(),
        conversationId: generateUuidV7(),
        senderId: testUserId,
        recipientId: generateUuidV7(),
        content: 'Hello via worker daemon test',
      },
      status: 'PENDING',
      attempts: 0,
      availableAt: new Date(0), // Head of the queue
    });

    // Execute ticks until test event is drained
    let updatedRow;
    for (let i = 0; i < 5; i++) {
      await daemonService.processSingleTick();
      [updatedRow] = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.id, testEventId));
      if (updatedRow?.status === 'PUBLISHED') break;
    }

    expect(updatedRow).toBeDefined();
    expect(updatedRow?.status).toBe('PUBLISHED');
    expect(updatedRow?.processedAt).toBeDefined();
  });

  it('isolates errors if a consumer step fails without crashing daemon process', async () => {
    // Create a standalone daemon with a failing consumer
    const failingConsumer = {
      processPendingEvents: async () => {
        throw new Error('Simulated database deadlock during outbox processing');
      },
    };
    const mockDeliveryWorker = { processJobs: async () => 0 };
    const mockWebhookConsumer = { processPendingWebhooks: async () => 0 };
    const mockExpirationWorker = {
      processExpirations: async () => ({ expiredEntitlements: 0, expiredSubscriptions: 0 }),
    };

    const resilientDaemon = new WorkerDaemonService(
      failingConsumer as any,
      mockDeliveryWorker as any,
      mockWebhookConsumer as any,
      mockExpirationWorker as any,
      { pollIntervalMs: 50, expirationIntervalMs: 10000 }
    );

    // Should not throw
    const count = await resilientDaemon.processSingleTick();
    expect(count).toBe(0);
    expect(resilientDaemon.currentMetrics.errors).toBe(1);
  });
});
