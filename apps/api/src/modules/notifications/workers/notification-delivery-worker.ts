import { Injectable, Inject } from '@nestjs/common';
import {
  NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN,
  type INotificationDeliveryJobsRepository,
} from '../repositories/notification-delivery-jobs.repository.interface.js';
import {
  NOTIFICATIONS_REPOSITORY_TOKEN,
  type INotificationsRepository,
} from '../repositories/notifications.repository.interface.js';
import {
  DEVICES_REPOSITORY_TOKEN,
  type IDevicesRepository,
} from '../repositories/devices.repository.interface.js';
import {
  APNS_PROVIDER_TOKEN,
  FCM_PROVIDER_TOKEN,
  type IPushNotificationProvider,
} from '../providers/push-provider.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class NotificationDeliveryWorker {
  constructor(
    @Inject(NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN)
    private readonly deliveryJobsRepo: INotificationDeliveryJobsRepository,
    @Inject(NOTIFICATIONS_REPOSITORY_TOKEN)
    private readonly notificationsRepo: INotificationsRepository,
    @Inject(DEVICES_REPOSITORY_TOKEN)
    private readonly devicesRepo: IDevicesRepository,
    @Inject(APNS_PROVIDER_TOKEN)
    private readonly apnsProvider: IPushNotificationProvider,
    @Inject(FCM_PROVIDER_TOKEN)
    private readonly fcmProvider: IPushNotificationProvider,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Process a batch of claimed notification delivery jobs.
   */
  async processJobs(limit: number = 20, workerId: string = `worker-${generateUuidV7()}`): Promise<number> {
    // 1. Reclaim any stuck jobs from crashed workers
    await this.deliveryJobsRepo.recoverStuckJobs(5);

    // 2. Claim pending / retrying jobs
    const jobs = await this.deliveryJobsRepo.claimPendingJobs(limit, workerId);
    if (jobs.length === 0) {
      return 0;
    }

    let processedCount = 0;
    for (const job of jobs) {
      try {
        await this.deliverJob(job.id, job.notificationId, job.deviceId);
        processedCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[DeliveryWorker] Unexpected error delivering job ${job.id}: ${errorMsg}`,
          undefined,
          'NotificationDeliveryWorker'
        );
      }
    }

    return processedCount;
  }

  private async deliverJob(
    jobId: string,
    notificationId: string,
    deviceId: string
  ): Promise<void> {
    // 1. Fetch notification and device
    const notification = await this.notificationsRepo.findById(notificationId);
    if (!notification) {
      await this.deliveryJobsRepo.markCancelled(jobId, 'Notification not found');
      return;
    }

    // 2. Check notification expiration
    if (notification.expiresAt && notification.expiresAt < new Date()) {
      await this.deliveryJobsRepo.markCancelled(jobId, 'Notification expired');
      return;
    }

    // 3. Fetch device
    const device = await this.devicesRepo.findById(deviceId);
    if (!device || device.revokedAt || !device.pushToken) {
      await this.deliveryJobsRepo.markFailed(
        jobId,
        'TOKEN_INVALID',
        'Device or push token is no longer active',
        true
      );
      return;
    }

    // 4. Check recipient safety / ban status
    const restrictions = await this.userRestrictionsRepo.findActiveRestrictions(notification.userId);
    const isBanned = restrictions.some((r: { restrictionType: string }) =>
      ['FULL_ACCOUNT', 'ACCOUNT_LOGIN'].includes(r.restrictionType)
    );
    if (isBanned && notification.type !== 'ACCOUNT_RESTRICTION') {
      await this.deliveryJobsRepo.markCancelled(jobId, 'User account is restricted');
      return;
    }

    // 5. Select push provider
    const provider = device.pushProvider === 'FCM' || device.platform === 'ANDROID'
      ? this.fcmProvider
      : this.apnsProvider;

    // 6. Send push request
    const result = await provider.send({
      token: device.pushToken,
      platform: (device.platform?.toUpperCase() || 'IOS') as 'IOS' | 'ANDROID',
      provider: provider.providerType,
      title: notification.title,
      body: notification.body,
      data: (notification.data as Record<string, unknown>) || undefined,
      priority: (notification.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL') || 'NORMAL',
    });

    if (result.success) {
      await this.deliveryJobsRepo.markSent(jobId, result.providerMessageId);
      return;
    }

    // 7. Handle failure
    if (result.isPermanentFailure) {
      await this.deliveryJobsRepo.markFailed(
        jobId,
        result.errorCategory || 'UNKNOWN_PERMANENT_ERROR',
        result.errorMessage || 'Permanent delivery failure',
        true
      );

      // Invalidate device token if token is dead
      if (['TOKEN_INVALID', 'TOKEN_UNREGISTERED'].includes(result.errorCategory || '')) {
        await this.devicesRepo.invalidatePushToken(device.pushToken);
        await this.databaseService.client.insert(securityEvents).values({
          id: generateUuidV7(),
          userId: device.userId,
          eventType: 'device.token.invalidated',
          severity: 'WARN',
          metadata: {
            deviceId: device.id,
            errorCategory: result.errorCategory,
          },
        });
      }
    } else {
      // Retryable failure: exponential backoff with jitter (e.g. 15s * 2^attempt)
      const baseDelay = 15;
      const jitter = Math.floor(Math.random() * 5);
      const delaySeconds = baseDelay * 2 + jitter;
      const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

      await this.deliveryJobsRepo.markFailed(
        jobId,
        result.errorCategory || 'TEMPORARY_PROVIDER_ERROR',
        result.errorMessage || 'Temporary provider failure',
        false,
        nextAttemptAt
      );
    }
  }
}
