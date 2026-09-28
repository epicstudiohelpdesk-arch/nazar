/**
 * Notifications Worker Boundary
 * Handles delivery of push notifications (APNs, FCM) and transactional emails.
 */

export interface NotificationJobPayload {
  readonly recipientUserId: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, string>;
}

export interface WorkerRunner {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class NotificationsWorker implements WorkerRunner {
  readonly name = 'worker-notifications';

  async start(): Promise<void> {
    // Worker loop will be bound to durable queue in later gate
  }

  async stop(): Promise<void> {
    // Graceful drain
  }
}
