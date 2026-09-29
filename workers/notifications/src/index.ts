/**
 * Notifications Worker Boundary
 * Gate 10: Handles asynchronous consumption of domain outbox events and
 * delivery of push notifications (APNs / FCM).
 */

export interface NotificationJobPayload {
  readonly recipientUserId: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, string>;
}

export interface WorkerRunner {
  readonly name: string;
  readonly isRunning: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface NotificationsWorkerOptions {
  readonly pollIntervalMs?: number;
  readonly batchSize?: number;
  readonly onTick?: () => Promise<void>;
}

export class NotificationsWorker implements WorkerRunner {
  readonly name = 'worker-notifications';
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly onTick?: (() => Promise<void>) | undefined;

  constructor(options: NotificationsWorkerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 20;
    this.onTick = options.onTick;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Start background processing loop
    const runLoop = async () => {
      if (!this.running) return;
      try {
        if (this.onTick) {
          await this.onTick();
        }
      } catch (err: unknown) {
        console.error(`[NotificationsWorker] Error during worker tick:`, err);
      } finally {
        if (this.running) {
          this.timer = setTimeout(runLoop, this.pollIntervalMs);
        }
      }
    };

    this.timer = setTimeout(runLoop, 0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async processTick(): Promise<number> {
    if (this.onTick) {
      await this.onTick();
      return this.batchSize;
    }
    return 0;
  }
}
