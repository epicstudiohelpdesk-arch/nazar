/**
 * Media Processing Worker Boundary
 * Handles asynchronous media transformations, thumbnailing, and AV scanning.
 */

export interface MediaJobPayload {
  readonly mediaId: string;
  readonly storageKey: string;
  readonly mimeType: string;
}

export interface WorkerRunner {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class MediaWorker implements WorkerRunner {
  readonly name = 'worker-media';

  async start(): Promise<void> {
    // Worker loop will be bound to durable queue in later gate
  }

  async stop(): Promise<void> {
    // Graceful drain
  }
}
