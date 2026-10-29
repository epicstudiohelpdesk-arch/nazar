import { Injectable, Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { NotificationEventConsumer } from '../notifications/workers/notification-event-consumer.js';
import { NotificationDeliveryWorker } from '../notifications/workers/notification-delivery-worker.js';
import { BillingWebhookConsumer } from '../payments/workers/billing-webhook-consumer.js';
import { EntitlementExpirationWorker } from '../payments/workers/entitlement-expiration-worker.js';

export interface WorkerDaemonMetrics {
  ticks: number;
  outboxEventsProcessed: number;
  notificationsDelivered: number;
  billingWebhooksProcessed: number;
  expirationsProcessed: number;
  errors: number;
}

export interface WorkerDaemonOptions {
  pollIntervalMs?: number;
  activeBatchDelayMs?: number;
  expirationIntervalMs?: number;
}

@Injectable()
export class WorkerDaemonService implements OnApplicationShutdown {
  private readonly logger = new Logger(WorkerDaemonService.name);
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private isTickInProgress = false;
  private lastExpirationRunTime = 0;

  private readonly pollIntervalMs: number;
  private readonly activeBatchDelayMs: number;
  private readonly expirationIntervalMs: number;

  private readonly metrics: WorkerDaemonMetrics = {
    ticks: 0,
    outboxEventsProcessed: 0,
    notificationsDelivered: 0,
    billingWebhooksProcessed: 0,
    expirationsProcessed: 0,
    errors: 0,
  };

  constructor(
    @Inject(NotificationEventConsumer)
    private readonly outboxConsumer: NotificationEventConsumer,
    @Inject(NotificationDeliveryWorker)
    private readonly deliveryWorker: NotificationDeliveryWorker,
    @Inject(BillingWebhookConsumer)
    private readonly webhookConsumer: BillingWebhookConsumer,
    @Inject(EntitlementExpirationWorker)
    private readonly expirationWorker: EntitlementExpirationWorker,
    options?: WorkerDaemonOptions
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.activeBatchDelayMs = options?.activeBatchDelayMs ?? 50;
    this.expirationIntervalMs = options?.expirationIntervalMs ?? 60000; // 1 minute
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentMetrics(): Readonly<WorkerDaemonMetrics> {
    return { ...this.metrics };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.log('[WorkerDaemon] Background worker daemon loop started');

    const loop = async () => {
      if (!this.running) return;
      let hadWork = false;
      try {
        const processedCount = await this.processSingleTick();
        hadWork = processedCount > 0;
      } catch (err: unknown) {
        this.metrics.errors++;
        this.logger.error(
          `[WorkerDaemon] Unexpected error during worker tick: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined
        );
      } finally {
        if (this.running) {
          // If work was found, tick again quickly to drain queue; otherwise wait idle interval
          const nextDelay = hadWork ? this.activeBatchDelayMs : this.pollIntervalMs;
          this.timer = setTimeout(loop, nextDelay);
        }
      }
    };

    this.timer = setTimeout(loop, 0);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Wait if a tick is currently executing
    let attempts = 0;
    while (this.isTickInProgress && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    this.logger.log('[WorkerDaemon] Background worker daemon loop cleanly stopped');
  }

  /**
   * Performs a single complete cycle across outbox events, push deliveries,
   * billing webhooks, and periodic entitlement expirations.
   */
  async processSingleTick(): Promise<number> {
    if (this.isTickInProgress) return 0;
    this.isTickInProgress = true;
    this.metrics.ticks++;

    let totalProcessedInTick = 0;

    try {
      // 1. Process pending outbox events (outbox -> durable notifications & jobs)
      try {
        const outboxCount = await this.outboxConsumer.processPendingEvents(50);
        this.metrics.outboxEventsProcessed += outboxCount;
        totalProcessedInTick += outboxCount;
      } catch (err: unknown) {
        this.metrics.errors++;
        this.logger.error(
          `[WorkerDaemon] Outbox consumer failure: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // 2. Deliver pending push notification jobs to APNs / FCM
      try {
        const deliveryCount = await this.deliveryWorker.processJobs(50);
        this.metrics.notificationsDelivered += deliveryCount;
        totalProcessedInTick += deliveryCount;
      } catch (err: unknown) {
        this.metrics.errors++;
        this.logger.error(
          `[WorkerDaemon] Notification delivery failure: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // 3. Process queued billing webhooks
      try {
        const webhookCount = await this.webhookConsumer.processPendingWebhooks(20);
        this.metrics.billingWebhooksProcessed += webhookCount;
        totalProcessedInTick += webhookCount;
      } catch (err: unknown) {
        this.metrics.errors++;
        this.logger.error(
          `[WorkerDaemon] Billing webhook consumer failure: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // 4. Periodic Entitlement & Subscription Expiration Sweep
      const now = Date.now();
      if (now - this.lastExpirationRunTime >= this.expirationIntervalMs) {
        this.lastExpirationRunTime = now;
        try {
          const { expiredEntitlements, expiredSubscriptions } =
            await this.expirationWorker.processExpirations();
          const expirations = expiredEntitlements + expiredSubscriptions;
          this.metrics.expirationsProcessed += expirations;
          totalProcessedInTick += expirations;
        } catch (err: unknown) {
          this.metrics.errors++;
          this.logger.error(
            `[WorkerDaemon] Entitlement expiration sweep failure: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      return totalProcessedInTick;
    } finally {
      this.isTickInProgress = false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }
}
