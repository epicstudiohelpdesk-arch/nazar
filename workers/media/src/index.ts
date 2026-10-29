/**
 * Media Processing Worker Boundary
 * Handles asynchronous media transformations, thumbnailing, and AV scanning.
 */

export * from './image-processor.js';
import { ImageProcessor, type ProcessedImageResult } from './image-processor.js';

export interface MediaJobPayload {
  readonly mediaId: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly buffer?: Buffer;
}

export interface WorkerRunner {
  readonly name: string;
  readonly isRunning: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface MediaWorkerOptions {
  readonly onProcessJob?: (job: MediaJobPayload) => Promise<ProcessedImageResult>;
}

export class MediaWorker implements WorkerRunner {
  readonly name = 'worker-media';
  private running = false;
  private readonly processor: ImageProcessor;
  private readonly onProcessJob?:
    ((job: MediaJobPayload) => Promise<ProcessedImageResult>) | undefined;

  constructor(options: MediaWorkerOptions = {}) {
    this.processor = new ImageProcessor();
    this.onProcessJob = options.onProcessJob;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async processJob(job: MediaJobPayload): Promise<ProcessedImageResult> {
    if (this.onProcessJob) {
      return this.onProcessJob(job);
    }
    if (!job.buffer) {
      throw new Error(`MediaJobPayload for ${job.mediaId} is missing buffer data`);
    }
    return this.processor.processImage(job.buffer);
  }
}
