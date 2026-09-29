import { Injectable, Inject } from '@nestjs/common';
import {
  SUBSCRIPTIONS_REPOSITORY_TOKEN,
  type ISubscriptionsRepository,
} from '../repositories/subscriptions.repository.interface.js';
import {
  ENTITLEMENTS_REPOSITORY_TOKEN,
  type IEntitlementsRepository,
} from '../repositories/entitlements.repository.interface.js';
import {
  PRODUCTS_REPOSITORY_TOKEN,
  type IProductsRepository,
} from '../repositories/products.repository.interface.js';
import { PaymentProviderFactory } from '../providers/payment-provider.factory.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import type { PaymentProviderType } from '@platform/api-contracts';

export interface ReconciliationResult {
  readonly subscriptionId: string;
  readonly previousStatus: string;
  readonly newStatus: string;
  readonly repaired: boolean;
  readonly reason?: string;
}

@Injectable()
export class BillingReconciliationService {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY_TOKEN)
    private readonly subscriptionsRepo: ISubscriptionsRepository,
    @Inject(ENTITLEMENTS_REPOSITORY_TOKEN)
    private readonly entitlementsRepo: IEntitlementsRepository,
    @Inject(PRODUCTS_REPOSITORY_TOKEN)
    private readonly productsRepo: IProductsRepository,
    @Inject(PaymentProviderFactory)
    private readonly providerFactory: PaymentProviderFactory,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Reconcile local subscription and entitlement state against authoritative provider state.
   */
  async reconcileSubscription(subscriptionId: string): Promise<ReconciliationResult> {
    const sub = await this.subscriptionsRepo.findById(subscriptionId);
    if (!sub) {
      return {
        subscriptionId,
        previousStatus: 'UNKNOWN',
        newStatus: 'UNKNOWN',
        repaired: false,
        reason: 'Subscription not found',
      };
    }

    const provider = this.providerFactory.getProvider(sub.provider as PaymentProviderType);
    if (!provider.getSubscription) {
      return {
        subscriptionId,
        previousStatus: sub.status,
        newStatus: sub.status,
        repaired: false,
        reason: 'Provider does not support direct query reconciliation',
      };
    }

    const providerState = await provider.getSubscription(sub.providerOriginalTransactionId);
    if (!providerState) {
      return {
        subscriptionId,
        previousStatus: sub.status,
        newStatus: sub.status,
        repaired: false,
      };
    }

    const now = new Date();
    let repaired = false;
    let newStatus = sub.status;

    // Detect mismatch: Provider says expired, but local active
    if (providerState.expiresDate && providerState.expiresDate < now && sub.status === 'ACTIVE') {
      this.logger.warn(
        `[Reconciliation] Local subscription ${sub.id} is ACTIVE but provider expired at ${providerState.expiresDate.toISOString()}. Repairing state.`,
        'BillingReconciliationService'
      );

      await this.subscriptionsRepo.updateStatus(sub.id, 'EXPIRED', {
        expiresAt: providerState.expiresDate,
      });
      await this.entitlementsRepo.revokeBySource('SUBSCRIPTION', sub.id, now);
      repaired = true;
      newStatus = 'EXPIRED';
    } else if (
      providerState.expiresDate &&
      providerState.expiresDate > now &&
      (sub.status === 'EXPIRED' || sub.status === 'PENDING')
    ) {
      // Local says expired, but provider renewed
      this.logger.warn(
        `[Reconciliation] Local subscription ${sub.id} is ${sub.status} but provider active until ${providerState.expiresDate.toISOString()}. Repairing state.`,
        'BillingReconciliationService'
      );

      await this.subscriptionsRepo.updateStatus(sub.id, 'ACTIVE', {
        currentPeriodEnd: providerState.expiresDate,
        expiresAt: providerState.expiresDate,
      });

      const grantedCodes = await this.productsRepo.getGrantedEntitlements(sub.productId);
      for (const code of grantedCodes) {
        await this.entitlementsRepo.grantOrExtendEntitlement({
          userId: sub.userId,
          entitlementCode: code,
          sourceType: 'SUBSCRIPTION',
          sourceId: sub.id,
          status: 'ACTIVE',
          startsAt: now,
          expiresAt: providerState.expiresDate,
        });
      }

      repaired = true;
      newStatus = 'ACTIVE';
    }

    return {
      subscriptionId,
      previousStatus: sub.status,
      newStatus,
      repaired,
      reason: repaired ? 'Discrepancy reconciled against provider' : undefined,
    };
  }
}
