import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents, type OutboxEventRow } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { conversationReadStates } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import { profiles } from '../../../infrastructure/database/drizzle/schema/profiles.js';
import {
  NOTIFICATIONS_REPOSITORY_TOKEN,
  type INotificationsRepository,
} from '../repositories/notifications.repository.interface.js';
import {
  NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN,
  type INotificationPreferencesRepository,
} from '../repositories/notification-preferences.repository.interface.js';
import {
  DEVICES_REPOSITORY_TOKEN,
  type IDevicesRepository,
} from '../repositories/devices.repository.interface.js';
import {
  NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN,
  type INotificationDeliveryJobsRepository,
} from '../repositories/notification-delivery-jobs.repository.interface.js';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../../safety/repositories/user-blocks.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import type { NotificationType, NotificationPriority } from '@platform/api-contracts';

@Injectable()
export class NotificationEventConsumer {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(NOTIFICATIONS_REPOSITORY_TOKEN)
    private readonly notificationsRepo: INotificationsRepository,
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN)
    private readonly prefsRepo: INotificationPreferencesRepository,
    @Inject(DEVICES_REPOSITORY_TOKEN)
    private readonly devicesRepo: IDevicesRepository,
    @Inject(NOTIFICATION_DELIVERY_JOBS_REPOSITORY_TOKEN)
    private readonly deliveryJobsRepo: INotificationDeliveryJobsRepository,
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Process a batch of pending outbox events and transform them into durable notifications & delivery jobs.
   */
  async processPendingEvents(limit: number = 20): Promise<number> {
    const claimQuery = sql<OutboxEventRow>`
      WITH claimable AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING' AND available_at <= NOW()
        ORDER BY available_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events
      SET status = 'PROCESSING',
          processed_at = NOW()
      FROM claimable
      WHERE outbox_events.id = claimable.id
      RETURNING outbox_events.id,
                outbox_events.event_type AS "eventType",
                outbox_events.aggregate_type AS "aggregateType",
                outbox_events.aggregate_id AS "aggregateId",
                outbox_events.payload,
                outbox_events.status,
                outbox_events.attempts,
                outbox_events.available_at AS "availableAt",
                outbox_events.processed_at AS "processedAt",
                outbox_events.last_error AS "lastError",
                outbox_events.created_at AS "createdAt";
    `;

    const result = await this.databaseService.client.execute(claimQuery);
    const claimedEvents = (result.rows || result) as unknown as OutboxEventRow[];

    if (claimedEvents.length === 0) {
      return 0;
    }

    let processedCount = 0;
    for (const event of claimedEvents) {
      try {
        await this.handleOutboxEvent(event);
        // Mark published
        await this.databaseService.client
          .update(outboxEvents)
          .set({
            status: 'PUBLISHED',
            processedAt: new Date(),
            lastError: null,
          })
          .where(eq(outboxEvents.id, event.id));

        processedCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[NotificationConsumer] Error processing event ${event.id} (${event.eventType}): ${errorMsg}`,
          undefined,
          'NotificationEventConsumer'
        );

        const newAttempts = (event.attempts || 0) + 1;
        const maxAttempts = 5;
        const nextDelaySeconds = Math.min(30 * Math.pow(2, newAttempts), 3600);
        const nextAvailableAt = new Date(Date.now() + nextDelaySeconds * 1000);

        await this.databaseService.client
          .update(outboxEvents)
          .set({
            status: newAttempts >= maxAttempts ? 'FAILED' : 'PENDING',
            attempts: newAttempts,
            availableAt: nextAvailableAt,
            lastError: errorMsg,
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }

    return processedCount;
  }

  private async handleOutboxEvent(event: OutboxEventRow): Promise<void> {
    const payload = (event.payload || {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    switch (event.eventType) {
      case 'message.created':
        await this.handleMessageCreated(event.id, payload);
        break;

      case 'match.created':
        await this.handleMatchCreated(event.id, payload);
        break;

      case 'interaction.liked':
        await this.handleInteractionLiked(event.id, payload);
        break;

      case 'moderation.decision.applied':
        await this.handleModerationDecisionApplied(event.id, payload);
        break;

      case 'subscription.created':
      case 'subscription.renewed':
      case 'subscription.expired':
      case 'subscription.refunded':
      case 'payment.failed':
        await this.handleBillingEvent(event.id, event.eventType, payload);
        break;

      default:
        // Other events (user.blocked, conversation.closed, etc.) do not trigger direct user push notifications
        break;
    }
  }

  private async handleMessageCreated(
    eventId: string,
    payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const { messageId, conversationId, recipientUserId, senderUserId, body } = payload;
    if (!recipientUserId || !senderUserId || !messageId) return;

    // 1. Safety check: Gate 09 bidirectional block check
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(senderUserId, recipientUserId);
    if (isBlocked) {
      this.logger.warn(
        `[NotificationConsumer] Suppressing push for message ${messageId} due to block relationship`,
        'NotificationEventConsumer'
      );
      return;
    }

    // 2. Safety check: Recipient account restrictions
    const restrictions = await this.userRestrictionsRepo.findActiveRestrictions(recipientUserId);
    const isRestricted = restrictions.some((r: { restrictionType: string }) =>
      ['FULL_ACCOUNT', 'ACCOUNT_LOGIN', 'MESSAGING'].includes(r.restrictionType)
    );
    if (isRestricted) {
      return;
    }

    // 3. Preferences check
    const prefs = await this.prefsRepo.getPreferences(recipientUserId);
    if (!prefs.messageNotificationsEnabled) {
      return;
    }

    // 4. Stale message race condition check (Section 29):
    // If the message has already been read, do not send a push notification
    if (conversationId) {
      const [readState] = await this.databaseService.client
        .select({ lastReadMessageId: conversationReadStates.lastReadMessageId })
        .from(conversationReadStates)
        .where(
          and(
            eq(conversationReadStates.conversationId, conversationId),
            eq(conversationReadStates.userId, recipientUserId)
          )
        )
        .limit(1);

      if (readState?.lastReadMessageId === messageId) {
        this.logger.log(
          `[NotificationConsumer] Suppressing push for message ${messageId} because recipient already read it`,
          'NotificationEventConsumer'
        );
        return;
      }
    }

    // 5. Build safe title and preview
    let senderName = 'Someone';
    const [senderProfile] = await this.databaseService.client
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, senderUserId))
      .limit(1);

    if (senderProfile?.displayName) {
      senderName = senderProfile.displayName;
    }

    const title = `New message from ${senderName}`;
    const notificationBody =
      prefs.messagePreviewEnabled && body
        ? String(body).slice(0, 100).trim()
        : 'You have a new message';

    // 6. Create durable notification & delivery jobs
    await this.createNotificationAndJobs({
      sourceEventId: eventId,
      recipientUserId,
      type: 'NEW_MESSAGE',
      title,
      body: notificationBody,
      data: {
        type: 'NEW_MESSAGE',
        conversationId,
        messageId,
      },
      priority: 'NORMAL',
    });
  }

  private async handleMatchCreated(
    eventId: string,
    payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const { matchId, userAId, userBId } = payload;
    if (!matchId || !userAId || !userBId) return;

    for (const [recipientId, partnerId] of [
      [userAId, userBId],
      [userBId, userAId],
    ]) {
      // Check block
      const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(recipientId, partnerId);
      if (isBlocked) continue;

      // Check restrictions
      const restrictions = await this.userRestrictionsRepo.findActiveRestrictions(recipientId);
      if (restrictions.some((r: { restrictionType: string }) => ['FULL_ACCOUNT', 'ACCOUNT_LOGIN'].includes(r.restrictionType))) {
        continue;
      }

      // Check preferences
      const prefs = await this.prefsRepo.getPreferences(recipientId);
      if (!prefs.matchNotificationsEnabled) continue;

      let partnerName = 'someone';
      const [partnerProfile] = await this.databaseService.client
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.userId, partnerId))
        .limit(1);

      if (partnerProfile?.displayName) {
        partnerName = partnerProfile.displayName;
      }

      await this.createNotificationAndJobs({
        sourceEventId: eventId,
        recipientUserId: recipientId,
        type: 'NEW_MATCH',
        title: 'New Match!',
        body: `You and ${partnerName} liked each other`,
        data: {
          type: 'NEW_MATCH',
          matchId,
        },
        priority: 'NORMAL',
      });
    }
  }

  private async handleInteractionLiked(
    eventId: string,
    payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const { actorUserId, targetUserId } = payload;
    if (!actorUserId || !targetUserId) return;

    // Check block
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(actorUserId, targetUserId);
    if (isBlocked) return;

    // Check restrictions
    const restrictions = await this.userRestrictionsRepo.findActiveRestrictions(targetUserId);
    if (restrictions.some((r: { restrictionType: string }) => ['FULL_ACCOUNT', 'ACCOUNT_LOGIN'].includes(r.restrictionType))) {
      return;
    }

    // Check preferences
    const prefs = await this.prefsRepo.getPreferences(targetUserId);
    if (!prefs.likeNotificationsEnabled) return;

    await this.createNotificationAndJobs({
      sourceEventId: eventId,
      recipientUserId: targetUserId,
      type: 'NEW_LIKE',
      title: 'New Like',
      body: 'Someone liked your profile',
      data: {
        type: 'NEW_LIKE',
      },
      priority: 'LOW',
    });
  }

  private async handleModerationDecisionApplied(
    eventId: string,
    payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const { subjectUserId, decision } = payload;
    if (!subjectUserId || !decision) return;

    if (!['TEMPORARY_SUSPENSION', 'PERMANENT_SUSPENSION', 'BAN'].includes(decision)) {
      return;
    }

    await this.createNotificationAndJobs({
      sourceEventId: eventId,
      recipientUserId: subjectUserId,
      type: 'ACCOUNT_RESTRICTION',
      title: 'Important Account Notice',
      body: 'Your account status has been updated following a safety review.',
      data: {
        type: 'ACCOUNT_RESTRICTION',
      },
      priority: 'HIGH',
    });
  }

  private async handleBillingEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const userId = payload.userId as string | undefined;
    if (!userId) return;

    // Check account restrictions
    const restrictions = await this.userRestrictionsRepo.findActiveRestrictions(userId);
    if (restrictions.some((r: { restrictionType: string }) => ['FULL_ACCOUNT', 'ACCOUNT_LOGIN'].includes(r.restrictionType))) {
      return;
    }

    // Check preferences
    const prefs = await this.prefsRepo.getPreferences(userId);
    if (!prefs.systemNotificationsEnabled) return;

    let title = 'Subscription Update';
    let body = 'Your subscription status has changed.';
    let priority: NotificationPriority = 'NORMAL';

    switch (eventType) {
      case 'subscription.created':
        title = 'Premium Activated! 🎉';
        body = 'Welcome to Nazar Premium. Enjoy your new features!';
        break;
      case 'subscription.renewed':
        title = 'Subscription Renewed';
        body = 'Your Nazar Premium subscription has successfully renewed.';
        break;
      case 'subscription.expired':
        title = 'Subscription Expired';
        body = 'Your Nazar Premium access has ended. Renew anytime to restore your perks.';
        break;
      case 'subscription.refunded':
        title = 'Refund Processed';
        body = 'A refund has been processed for your subscription.';
        break;
      case 'payment.failed':
        title = 'Billing Issue';
        body = 'We could not renew your subscription. Please check your payment method.';
        priority = 'HIGH';
        break;
    }

    await this.createNotificationAndJobs({
      sourceEventId: eventId,
      recipientUserId: userId,
      type: 'SYSTEM_NOTICE',
      title,
      body,
      data: {
        type: 'SYSTEM_NOTICE',
        billingEventType: eventType,
        subscriptionId: payload.subscriptionId,
      },
      priority,
    });
  }

  private async createNotificationAndJobs(params: {
    sourceEventId: string;
    recipientUserId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    priority: NotificationPriority;
  }): Promise<void> {
    // 1. Create durable notification record (deduplicated against sourceEventId + recipientUserId + type)
    const { notification, isDuplicate } = await this.notificationsRepo.createNotification({
      userId: params.recipientUserId,
      sourceEventId: params.sourceEventId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data,
      priority: params.priority,
      readAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day retention
    });

    if (isDuplicate) {
      this.logger.log(
        `[NotificationConsumer] Notification already created for event ${params.sourceEventId}, skipping duplicate job creation`,
        'NotificationEventConsumer'
      );
      return;
    }

    // 2. Look up recipient's active devices
    const devices = await this.devicesRepo.findActiveDevicesByUserId(params.recipientUserId);
    if (devices.length === 0) {
      return;
    }

    // 3. Create independent delivery job for each device
    const jobs = devices.map((device) => ({
      notificationId: notification.id,
      deviceId: device.id,
      provider: device.pushProvider || (device.platform === 'ANDROID' ? 'FCM' : 'APNS'),
      status: 'PENDING' as const,
      attemptCount: 0,
      maxAttempts: 5,
      availableAt: new Date(),
    }));

    await this.deliveryJobsRepo.createJobs(jobs);
  }
}
