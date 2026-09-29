import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';
import {
  BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN,
  type IBillingWebhookEventsRepository,
} from '../repositories/billing-webhook-events.repository.interface.js';
import {
  SUBSCRIPTIONS_REPOSITORY_TOKEN,
  type ISubscriptionsRepository,
} from '../repositories/subscriptions.repository.interface.js';
import {
  PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN,
  type IPaymentTransactionsRepository,
} from '../repositories/payment-transactions.repository.interface.js';
import {
  ENTITLEMENTS_REPOSITORY_TOKEN,
  type IEntitlementsRepository,
} from '../repositories/entitlements.repository.interface.js';
import {
  PRODUCTS_REPOSITORY_TOKEN,
  type IProductsRepository,
} from '../repositories/products.repository.interface.js';
import { PaymentProviderFactory } from '../providers/payment-provider.factory.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import {
  type PaymentProviderType,
  type WebhookAcknowledgementDto,
} from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import type { BillingWebhookEventRow } from '../../../infrastructure/database/drizzle/schema/billing-webhook-events.js';

@Injectable()
export class BillingWebhookService {
  constructor(
    @Inject(BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN)
    private readonly webhookRepo: IBillingWebhookEventsRepository,
    @Inject(SUBSCRIPTIONS_REPOSITORY_TOKEN)
    private readonly subscriptionsRepo: ISubscriptionsRepository,
    @Inject(PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN)
    private readonly transactionsRepo: IPaymentTransactionsRepository,
    @Inject(ENTITLEMENTS_REPOSITORY_TOKEN)
    private readonly entitlementsRepo: IEntitlementsRepository,
    @Inject(PRODUCTS_REPOSITORY_TOKEN)
    private readonly productsRepo: IProductsRepository,
    @Inject(PaymentProviderFactory)
    private readonly providerFactory: PaymentProviderFactory,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Secure, idempotent webhook ingestion endpoint.
   * Authenticates provider payload, logs event, and ensures exactly-once execution.
   */
  async handleWebhook(
    providerType: PaymentProviderType,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    payload: Record<string, unknown>
  ): Promise<WebhookAcknowledgementDto> {
    const provider = this.providerFactory.getProvider(providerType);

    // 1. Authenticate & parse webhook event
    const verifiedEvent = await provider.verifyWebhook({
      provider: providerType,
      headers,
      rawBody,
      payload,
    });

    // 2. Compute payload SHA-256 hash
    const payloadHash = crypto
      .createHash('sha256')
      .update(typeof rawBody === 'string' && rawBody.length > 0 ? rawBody : JSON.stringify(payload))
      .digest('hex');

    // 3. Atomically record event with (provider, provider_event_id) uniqueness
    const { event, isDuplicate } = await this.webhookRepo.recordEvent({
      provider: providerType,
      providerEventId: verifiedEvent.providerEventId,
      eventType: verifiedEvent.eventType,
      payloadHash,
      rawPayload: verifiedEvent.rawMetadata || payload,
      receivedAt: new Date(),
      status: 'PENDING',
      attemptCount: 0,
    });

    if (isDuplicate) {
      this.logger.log(
        `[BillingWebhookService] Duplicate webhook delivery detected for ${providerType} (${verifiedEvent.providerEventId}), skipping processing`,
        'BillingWebhookService'
      );
      return { received: true, duplicate: true, eventId: event.id };
    }

    // 4. Process event (synchronously for reliable webhook response or queue for worker)
    try {
      await this.processWebhookEvent(event, verifiedEvent);
      await this.webhookRepo.markProcessed(event.id);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[BillingWebhookService] Error processing webhook event ${event.id}: ${errorMsg}`,
        undefined,
        'BillingWebhookService'
      );
      await this.webhookRepo.markFailed(event.id, errorMsg, true);
      throw new BadRequestException(`Webhook processing failed: ${errorMsg}`);
    }

    return { received: true, duplicate: false, eventId: event.id };
  }

  /**
   * Deterministically applies provider lifecycle event to subscriptions and entitlements.
   */
  async processWebhookEvent(
    event: BillingWebhookEventRow,
    verifiedEvent?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    const provider = this.providerFactory.getProvider(event.provider as PaymentProviderType);
    const parsed =
      verifiedEvent ||
      (await provider.verifyWebhook({
        provider: event.provider as PaymentProviderType,
        headers: {},
        rawBody: '',
        payload: event.rawPayload as Record<string, unknown>,
      }));

    this.logger.log(
      `[BillingWebhookService] Processing webhook event ${event.id}: ${parsed.eventType} for originalTxId: ${parsed.originalTransactionId}`,
      'BillingWebhookService'
    );

    const subscription = await this.subscriptionsRepo.findByProviderOriginalTransactionId(
      event.provider,
      parsed.originalTransactionId
    );

    if (!subscription) {
      this.logger.warn(
        `[BillingWebhookService] No subscription found matching originalTxId: ${parsed.originalTransactionId}`,
        'BillingWebhookService'
      );
      return;
    }

    const now = new Date();

    // Out-of-order check: If incoming event is older than current subscription update timestamp, do not regress state
    if (parsed.eventDate && subscription.updatedAt && parsed.eventDate < subscription.updatedAt) {
      this.logger.warn(
        `[BillingWebhookService] Stale out-of-order webhook event received (eventDate ${parsed.eventDate.toISOString()} < updatedAt ${subscription.updatedAt.toISOString()}). Skipping state regression.`,
        'BillingWebhookService'
      );
      return;
    }

    await this.databaseService.client.transaction(async (tx) => {
      switch (parsed.eventType) {
        case 'RENEWAL': {
          const periodStart = parsed.periodStart || now;
          const periodEnd =
            parsed.periodEnd || new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          await this.subscriptionsRepo.updateStatus(
            subscription.id,
            'ACTIVE',
            {
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              expiresAt: periodEnd,
              autoRenewEnabled: true,
              gracePeriodUntil: null,
            },
            tx
          );

          // Record renewal transaction if transaction ID is present
          const txId = parsed.transactionId || `renew-${event.id}`;
          await this.transactionsRepo.createTransaction(
            {
              userId: subscription.userId,
              productId: subscription.productId,
              subscriptionId: subscription.id,
              provider: event.provider,
              providerTransactionId: txId,
              providerOriginalTransactionId: subscription.providerOriginalTransactionId,
              transactionType: 'RENEWAL',
              status: 'SUCCEEDED',
              amountMinor: 19900,
              currency: 'INR',
              providerCreatedAt: parsed.eventDate || now,
              verifiedAt: now,
              providerMetadata: parsed.rawMetadata || {},
            },
            tx
          );

          // Extend entitlements
          const grantedCodes = await this.productsRepo.getGrantedEntitlements(subscription.productId, tx);
          for (const code of grantedCodes) {
            await this.entitlementsRepo.grantOrExtendEntitlement(
              {
                userId: subscription.userId,
                entitlementCode: code,
                sourceType: 'SUBSCRIPTION',
                sourceId: subscription.id,
                status: 'ACTIVE',
                startsAt: periodStart,
                expiresAt: periodEnd,
              },
              tx
            );
          }

          // Emit outbox events
          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'subscription.renewed',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscription.id,
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
              expiresAt: periodEnd.toISOString(),
            },
            status: 'PENDING',
          });
          break;
        }

        case 'CANCEL': {
          // Cancellation disables auto-renew but preserves access until currentPeriodEnd!
          await this.subscriptionsRepo.updateStatus(
            subscription.id,
            subscription.status, // preserve ACTIVE
            {
              autoRenewEnabled: false,
              cancelledAt: now,
            },
            tx
          );

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'subscription.cancelled',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscription.id,
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            },
            status: 'PENDING',
          });
          break;
        }

        case 'DID_FAIL_TO_RENEW': {
          // Transition to GRACE_PERIOD - access maintained during grace period
          const graceUntil =
            parsed.gracePeriodUntil || new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);

          await this.subscriptionsRepo.updateStatus(
            subscription.id,
            'GRACE_PERIOD',
            {
              gracePeriodUntil: graceUntil,
            },
            tx
          );

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'payment.failed',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscription.id,
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
              gracePeriodUntil: graceUntil.toISOString(),
            },
            status: 'PENDING',
          });
          break;
        }

        case 'EXPIRE': {
          await this.subscriptionsRepo.updateStatus(
            subscription.id,
            'EXPIRED',
            {
              expiresAt: now,
            },
            tx
          );

          // Expire entitlements
          await this.entitlementsRepo.revokeBySource('SUBSCRIPTION', subscription.id, now, tx);

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'subscription.expired',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscription.id,
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
            },
            status: 'PENDING',
          });
          break;
        }

        case 'REFUND':
        case 'REVOKE': {
          await this.subscriptionsRepo.updateStatus(
            subscription.id,
            parsed.eventType === 'REFUND' ? 'REFUNDED' : 'REVOKED',
            {
              cancelledAt: now,
              expiresAt: now,
              autoRenewEnabled: false,
            },
            tx
          );

          // Revoke entitlements immediately!
          await this.entitlementsRepo.revokeBySource('SUBSCRIPTION', subscription.id, now, tx);

          // Record refund transaction
          await this.transactionsRepo.createTransaction(
            {
              userId: subscription.userId,
              productId: subscription.productId,
              subscriptionId: subscription.id,
              provider: event.provider,
              providerTransactionId: parsed.transactionId || `refund-${event.id}`,
              providerOriginalTransactionId: subscription.providerOriginalTransactionId,
              transactionType: parsed.eventType === 'REFUND' ? 'REFUND' : 'REVOCATION',
              status: 'REFUNDED',
              amountMinor: 0,
              currency: 'INR',
              providerCreatedAt: parsed.eventDate || now,
              verifiedAt: now,
              providerMetadata: parsed.rawMetadata || {},
            },
            tx
          );

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: parsed.eventType === 'REFUND' ? 'subscription.refunded' : 'subscription.revoked',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscription.id,
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
              type: parsed.eventType,
            },
            status: 'PENDING',
          });
          break;
        }

        default:
          break;
      }
    });
  }
}
