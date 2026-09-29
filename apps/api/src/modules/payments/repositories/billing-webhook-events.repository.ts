import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  billingWebhookEvents,
  type BillingWebhookEventRow,
  type NewBillingWebhookEventRow,
} from '../../../infrastructure/database/drizzle/schema/billing-webhook-events.js';
import type { IBillingWebhookEventsRepository } from './billing-webhook-events.repository.interface.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class BillingWebhookEventsRepository implements IBillingWebhookEventsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async recordEvent(
    data: Omit<NewBillingWebhookEventRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<{ event: BillingWebhookEventRow; isDuplicate: boolean }> {
    const client = this.getClient(tx);
    const now = new Date();
    const id = generateUuidV7();

    const insertResult = await client
      .insert(billingWebhookEvents)
      .values({
        id,
        provider: data.provider,
        providerEventId: data.providerEventId,
        eventType: data.eventType,
        payloadHash: data.payloadHash,
        rawPayload: data.rawPayload,
        receivedAt: data.receivedAt || now,
        status: 'PENDING',
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [billingWebhookEvents.provider, billingWebhookEvents.providerEventId],
      })
      .returning();

    if (insertResult.length > 0) {
      return { event: insertResult[0]!, isDuplicate: false };
    }

    // Duplicate event delivered - fetch existing
    const existing = await this.findByProviderEventId(data.provider, data.providerEventId, tx);
    return { event: existing!, isDuplicate: true };
  }

  async findByProviderEventId(
    provider: string,
    providerEventId: string,
    tx?: DrizzleDatabase
  ): Promise<BillingWebhookEventRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(billingWebhookEvents)
      .where(
        and(
          eq(billingWebhookEvents.provider, provider),
          eq(billingWebhookEvents.providerEventId, providerEventId)
        )
      )
      .limit(1);

    return row || null;
  }

  async claimPendingEvents(
    limit: number,
    _workerId: string
  ): Promise<readonly BillingWebhookEventRow[]> {
    const query = sql<BillingWebhookEventRow>`
      WITH claimable AS (
        SELECT id
        FROM billing_webhook_events
        WHERE status = 'PENDING'
        ORDER BY received_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE billing_webhook_events
      SET status = 'PROCESSING',
          updated_at = NOW()
      FROM claimable
      WHERE billing_webhook_events.id = claimable.id
      RETURNING billing_webhook_events.id,
                billing_webhook_events.provider,
                billing_webhook_events.provider_event_id AS "providerEventId",
                billing_webhook_events.event_type AS "eventType",
                billing_webhook_events.payload_hash AS "payloadHash",
                billing_webhook_events.raw_payload AS "rawPayload",
                billing_webhook_events.received_at AS "receivedAt",
                billing_webhook_events.processed_at AS "processedAt",
                billing_webhook_events.status,
                billing_webhook_events.attempt_count AS "attemptCount",
                billing_webhook_events.last_error AS "lastError",
                billing_webhook_events.created_at AS "createdAt",
                billing_webhook_events.updated_at AS "updatedAt";
    `;

    const result = await this.databaseService.client.execute(query);
    const rows = (result.rows || result) as unknown as BillingWebhookEventRow[];
    return rows;
  }

  async markProcessed(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(billingWebhookEvents)
      .set({
        status: 'PROCESSED',
        processedAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(billingWebhookEvents.id, id))
      .returning({ id: billingWebhookEvents.id });

    return result.length > 0;
  }

  async markFailed(
    id: string,
    error: string,
    retryable: boolean = true,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const [row] = await client
      .select({ attempts: billingWebhookEvents.attemptCount })
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, id))
      .limit(1);

    const attempts = (row?.attempts || 0) + 1;
    const finalStatus = !retryable || attempts >= 5 ? 'FAILED' : 'PENDING';

    const result = await client
      .update(billingWebhookEvents)
      .set({
        status: finalStatus,
        attemptCount: attempts,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(billingWebhookEvents.id, id))
      .returning({ id: billingWebhookEvents.id });

    return result.length > 0;
  }
}
