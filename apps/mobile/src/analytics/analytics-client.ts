import type {
  AnalyticsClientEventItemDto,
  IngestAnalyticsEventsDto,
  IngestAnalyticsEventsResultDto,
} from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import type { AuthClient } from '../auth/auth-client.js';

export interface AnalyticsClientOptions {
  readonly authClient: AuthClient;
  readonly maxQueueSize?: number;
  readonly batchSize?: number;
  readonly flushIntervalMs?: number;
  readonly platform?: 'ios' | 'android' | 'web';
  readonly appVersion?: string;
}

export class AnalyticsClient {
  private queue: AnalyticsClientEventItemDto[] = [];
  private readonly authClient: AuthClient;
  private readonly maxQueueSize: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly platform: 'ios' | 'android' | 'web';
  private readonly appVersion?: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private anonymousId: string;
  private isFlushing = false;

  constructor(options: AnalyticsClientOptions) {
    this.authClient = options.authClient;
    this.maxQueueSize = options.maxQueueSize ?? 500;
    this.batchSize = options.batchSize ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 10000; // 10s default
    this.platform = options.platform ?? 'ios';
    this.appVersion = options.appVersion ?? '1.0.0';
    this.anonymousId = generateUuidV7();

    this.startAutoFlush();
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get currentAnonymousId(): string {
    return this.anonymousId;
  }

  setAnonymousId(id: string): void {
    this.anonymousId = id;
  }

  /**
   * Tracks a client telemetry event.
   * Enqueues locally and guarantees timestamp preservation.
   */
  track(eventName: string, properties: Record<string, unknown> = {}, eventVersion = 1): string {
    const eventId = generateUuidV7();
    const eventItem: AnalyticsClientEventItemDto = {
      eventId,
      eventName,
      eventVersion,
      occurredAt: new Date().toISOString(),
      anonymousId: this.anonymousId,
      platform: this.platform,
      appVersion: this.appVersion,
      properties,
    };

    // Bounded queue: Drop oldest event if at max capacity
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push(eventItem);

    // Flush immediately if batchSize reached
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }

    return eventId;
  }

  /**
   * Flushes queued events to the backend in bounded batches.
   */
  async flush(): Promise<IngestAnalyticsEventsResultDto | null> {
    if (this.isFlushing || this.queue.length === 0) {
      return null;
    }

    this.isFlushing = true;
    const batch = this.queue.slice(0, this.batchSize);

    try {
      const payload: IngestAnalyticsEventsDto = {
        events: batch,
      };

      const res = await this.authClient.request<IngestAnalyticsEventsResultDto>(
        '/v1/analytics/events',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (res.success && res.data) {
        // Remove successfully dispatched batch from local queue
        this.queue.splice(0, batch.length);
        return res.data;
      }
      return null;
    } catch (err: unknown) {
      console.warn('[AnalyticsClient] Error flushing events, will retry on next tick:', err);
      return null;
    } finally {
      this.isFlushing = false;
    }
  }

  private startAutoFlush(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsClient {
  return new AnalyticsClient(options);
}
