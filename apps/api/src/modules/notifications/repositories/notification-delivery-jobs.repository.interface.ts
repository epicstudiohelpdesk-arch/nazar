import type {
  NotificationDeliveryJobRow,
  NewNotificationDeliveryJobRow,
} from '../../../infrastructure/database/drizzle/schema/notification-delivery-jobs.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface INotificationDeliveryJobsRepository {
  createJobs(
    jobs: readonly Omit<NewNotificationDeliveryJobRow, 'id' | 'createdAt' | 'updatedAt'>[],
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationDeliveryJobRow[]>;

  claimPendingJobs(limit: number, workerId: string): Promise<readonly NotificationDeliveryJobRow[]>;

  markSent(jobId: string, providerMessageId?: string): Promise<boolean>;

  markFailed(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    isPermanent: boolean,
    nextAttemptAt?: Date
  ): Promise<boolean>;

  markCancelled(jobId: string, reason?: string): Promise<boolean>;

  findJobsByNotificationId(
    notificationId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationDeliveryJobRow[]>;

  recoverStuckJobs(leaseTimeoutMinutes?: number): Promise<number>;
}

export const NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN = Symbol(
  'INotificationDeliveryJobsRepository'
);
