/**
 * Content Moderation Worker Boundary
 * Handles automated AI/vision checks, text profanity filters, and safety scoring.
 */

export interface ModerationJobPayload {
  readonly targetType: 'profile_photo' | 'bio' | 'chat_message';
  readonly targetId: string;
  readonly contentUri?: string;
  readonly rawText?: string;
}

export interface WorkerRunner {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class ModerationWorker implements WorkerRunner {
  readonly name = 'worker-moderation';

  async start(): Promise<void> {
    // Worker loop will be bound to durable queue in later gate
  }

  async stop(): Promise<void> {
    // Graceful drain
  }
}
