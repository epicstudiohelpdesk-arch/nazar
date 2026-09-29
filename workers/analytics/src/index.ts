/**
 * Analytics and Metric Ingestion Worker Boundary (Gate 15)
 * Handles event pipeline aggregation, daily KPI rollups, funnel aggregation, and retention pruning.
 */

export interface AnalyticsJobPayload {
  readonly eventName: string;
  readonly userId?: string;
  readonly properties: Record<string, unknown>;
  readonly timestamp: string;
}

export interface WorkerRunner {
  readonly name: string;
  readonly isRunning: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface AnalyticsWorkerOptions {
  readonly pollIntervalMs?: number;
  readonly batchSize?: number;
  readonly retentionDays?: number;
  readonly onAggregateDailyMetrics?: (date: string) => Promise<number>;
  readonly onRetentionCleanup?: (retentionDays: number) => Promise<number>;
  readonly onQuarantineCleanup?: () => Promise<number>;
}

export class AnalyticsWorker implements WorkerRunner {
  readonly name = 'worker-analytics';
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly retentionDays: number;
  private readonly onAggregateDailyMetrics: ((date: string) => Promise<number>) | undefined;
  private readonly onRetentionCleanup: ((retentionDays: number) => Promise<number>) | undefined;
  private readonly onQuarantineCleanup: (() => Promise<number>) | undefined;

  constructor(options: AnalyticsWorkerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 60000; // 1 minute default interval
    this.batchSize = options.batchSize ?? 100;
    this.retentionDays = options.retentionDays ?? 90;
    this.onAggregateDailyMetrics = options.onAggregateDailyMetrics;
    this.onRetentionCleanup = options.onRetentionCleanup;
    this.onQuarantineCleanup = options.onQuarantineCleanup;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentBatchSize(): number {
    return this.batchSize;
  }

  get currentRetentionDays(): number {
    return this.retentionDays;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const runLoop = async () => {
      if (!this.running) return;
      try {
        await this.processTick();
      } catch (err: unknown) {
        console.error(`[AnalyticsWorker] Error during worker tick:`, err);
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

  async processTick(): Promise<{
    aggregated: number;
    cleaned: number;
    quarantinedCleaned: number;
  }> {
    let aggregated = 0;
    let cleaned = 0;
    let quarantinedCleaned = 0;

    const today = new Date().toISOString().split('T')[0]!;

    if (this.onAggregateDailyMetrics) {
      aggregated = await this.onAggregateDailyMetrics(today);
    }

    if (this.onRetentionCleanup) {
      cleaned = await this.onRetentionCleanup(this.retentionDays);
    }

    if (this.onQuarantineCleanup) {
      quarantinedCleaned = await this.onQuarantineCleanup();
    }

    return { aggregated, cleaned, quarantinedCleaned };
  }
}
