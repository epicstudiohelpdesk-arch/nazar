/**
 * Analytics and Metric Ingestion Worker Boundary
 * Handles event pipeline aggregation, discovery impressions, and metric calculations.
 */

export interface AnalyticsJobPayload {
  readonly eventName: string;
  readonly userId?: string;
  readonly properties: Record<string, unknown>;
  readonly timestamp: string;
}

export interface WorkerRunner {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class AnalyticsWorker implements WorkerRunner {
  readonly name = 'worker-analytics';

  async start(): Promise<void> {
    // Worker loop will be bound to durable queue in later gate
  }

  async stop(): Promise<void> {
    // Graceful drain
  }
}
