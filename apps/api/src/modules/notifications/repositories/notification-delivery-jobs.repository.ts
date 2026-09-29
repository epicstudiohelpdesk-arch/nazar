import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import {
  notificationDeliveryJobs,
  type NotificationDeliveryJobRow,
  type NewNotificationDeliveryJobRow,
} from '../../../infrastructure/database/drizzle/schema/notification-delivery-jobs.js';
import { generateUuidV7 } from '@platform/domain';
import type { INotificationDeliveryJobsRepository } from './notification-delivery-jobs.repository.interface.js';

@Injectable()
export class NotificationDeliveryJobsRepository implements INotificationDeliveryJobsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createJobs(
    jobs: readonly Omit<NewNotificationDeliveryJobRow, 'id' | 'createdAt' | 'updatedAt'>[],
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationDeliveryJobRow[]> {
    if (jobs.length === 0) return [];
    const client = this.getClient(tx);
    const now = new Date();
    const defaultAvailableAt = new Date(Date.now() - 1000);

    const insertValues = jobs.map((job) => ({
      id: generateUuidV7(),
      notificationId: job.notificationId,
      deviceId: job.deviceId,
      status: job.status || 'PENDING',
      attemptCount: job.attemptCount || 0,
      maxAttempts: job.maxAttempts || 5,
      availableAt: job.availableAt || defaultAvailableAt,
      provider: job.provider,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await client
      .insert(notificationDeliveryJobs)
      .values(insertValues)
      .onConflictDoNothing({
        target: [notificationDeliveryJobs.notificationId, notificationDeliveryJobs.deviceId],
      })
      .returning();

    return result;
  }

  async claimPendingJobs(
    limit: number,
    workerId: string
  ): Promise<readonly NotificationDeliveryJobRow[]> {
    // Atomic claiming via FOR UPDATE SKIP LOCKED
    const query = sql<NotificationDeliveryJobRow>`
      WITH claimable AS (
        SELECT id
        FROM notification_delivery_jobs
        WHERE (status IN ('PENDING', 'RETRYING') AND available_at <= NOW() + INTERVAL '1 second')
           OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY available_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_delivery_jobs
      SET status = 'PROCESSING',
          locked_at = NOW(),
          locked_by = ${workerId},
          last_attempt_at = NOW(),
          updated_at = NOW()
      FROM claimable
      WHERE notification_delivery_jobs.id = claimable.id
      RETURNING notification_delivery_jobs.id,
                notification_delivery_jobs.notification_id AS "notificationId",
                notification_delivery_jobs.device_id AS "deviceId",
                notification_delivery_jobs.status,
                notification_delivery_jobs.attempt_count AS "attemptCount",
                notification_delivery_jobs.max_attempts AS "maxAttempts",
                notification_delivery_jobs.available_at AS "availableAt",
                notification_delivery_jobs.locked_at AS "lockedAt",
                notification_delivery_jobs.locked_by AS "lockedBy",
                notification_delivery_jobs.last_attempt_at AS "lastAttemptAt",
                notification_delivery_jobs.next_attempt_at AS "nextAttemptAt",
                notification_delivery_jobs.provider,
                notification_delivery_jobs.provider_message_id AS "providerMessageId",
                notification_delivery_jobs.last_error_code AS "lastErrorCode",
                notification_delivery_jobs.last_error_message AS "lastErrorMessage",
                notification_delivery_jobs.last_error_at AS "lastErrorAt",
                notification_delivery_jobs.created_at AS "createdAt",
                notification_delivery_jobs.updated_at AS "updatedAt";
    `;

    const result = await this.databaseService.client.execute(query);
    const rows = (result.rows || result) as unknown as NotificationDeliveryJobRow[];
    return rows;
  }

  async markSent(jobId: string, providerMessageId?: string): Promise<boolean> {
    const now = new Date();
    const result = await this.databaseService.client
      .update(notificationDeliveryJobs)
      .set({
        status: 'SENT',
        providerMessageId: providerMessageId || null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(notificationDeliveryJobs.id, jobId))
      .returning({ id: notificationDeliveryJobs.id });

    return result.length > 0;
  }

  async markFailed(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    isPermanent: boolean,
    nextAttemptAt?: Date
  ): Promise<boolean> {
    const now = new Date();
    const [current] = await this.databaseService.client
      .select({ attemptCount: notificationDeliveryJobs.attemptCount, maxAttempts: notificationDeliveryJobs.maxAttempts })
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.id, jobId))
      .limit(1);

    const newAttemptCount = (current?.attemptCount || 0) + 1;
    const isExhausted = current ? newAttemptCount >= current.maxAttempts : false;
    const finalFailed = isPermanent || isExhausted;

    const result = await this.databaseService.client
      .update(notificationDeliveryJobs)
      .set({
        status: finalFailed ? 'FAILED' : 'RETRYING',
        attemptCount: newAttemptCount,
        availableAt: finalFailed ? now : (nextAttemptAt || now),
        nextAttemptAt: finalFailed ? null : (nextAttemptAt || now),
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        lastErrorAt: now,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(notificationDeliveryJobs.id, jobId))
      .returning({ id: notificationDeliveryJobs.id });

    return result.length > 0;
  }

  async markCancelled(jobId: string, reason?: string): Promise<boolean> {
    const now = new Date();
    const result = await this.databaseService.client
      .update(notificationDeliveryJobs)
      .set({
        status: 'CANCELLED',
        lastErrorMessage: reason || 'Cancelled due to expiration or safety suppression',
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(notificationDeliveryJobs.id, jobId))
      .returning({ id: notificationDeliveryJobs.id });

    return result.length > 0;
  }

  async findJobsByNotificationId(
    notificationId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationDeliveryJobRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.notificationId, notificationId));
  }

  async recoverStuckJobs(leaseTimeoutMinutes: number = 5): Promise<number> {
    const query = sql`
      UPDATE notification_delivery_jobs
      SET status = 'RETRYING',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND locked_at < NOW() - (${leaseTimeoutMinutes} || ' minutes')::INTERVAL
      RETURNING id;
    `;

    const result = await this.databaseService.client.execute(query);
    const rows = (result.rows || result) as unknown as Array<{ id: string }>;
    return rows.length;
  }
}
