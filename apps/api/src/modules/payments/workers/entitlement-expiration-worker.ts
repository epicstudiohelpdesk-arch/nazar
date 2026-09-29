import { Injectable, Inject } from '@nestjs/common';
import {
  ENTITLEMENTS_REPOSITORY_TOKEN,
  type IEntitlementsRepository,
} from '../repositories/entitlements.repository.interface.js';
import {
  SUBSCRIPTIONS_REPOSITORY_TOKEN,
  type ISubscriptionsRepository,
} from '../repositories/subscriptions.repository.interface.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class EntitlementExpirationWorker {
  constructor(
    @Inject(ENTITLEMENTS_REPOSITORY_TOKEN)
    private readonly entitlementsRepo: IEntitlementsRepository,
    @Inject(SUBSCRIPTIONS_REPOSITORY_TOKEN)
    private readonly subscriptionsRepo: ISubscriptionsRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Scan and expire entitlements and cancelled subscriptions past their paid period end.
   */
  async processExpirations(
    asOf: Date = new Date()
  ): Promise<{ expiredEntitlements: number; expiredSubscriptions: number }> {
    const expiredEnts = await this.entitlementsRepo.findExpiredActiveEntitlements(asOf);
    let expiredEntitlementsCount = 0;

    for (const ent of expiredEnts) {
      await this.databaseService.client.transaction(async (tx) => {
        await this.entitlementsRepo.expireEntitlement(ent.id, asOf, tx);

        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'entitlement.expired',
          aggregateType: 'ENTITLEMENT',
          aggregateId: ent.id,
          payload: {
            entitlementId: ent.id,
            userId: ent.userId,
            entitlementCode: ent.entitlementCode,
          },
          status: 'PENDING',
        });
      });

      expiredEntitlementsCount++;
    }

    // Also transition cancelled subscriptions past their paid expiration date
    const expiredSubs = await this.subscriptionsRepo.findExpiredActiveSubscriptions(asOf);
    let expiredSubscriptionsCount = 0;

    for (const sub of expiredSubs) {
      if (!sub.autoRenewEnabled) {
        await this.databaseService.client.transaction(async (tx) => {
          await this.subscriptionsRepo.updateStatus(sub.id, 'EXPIRED', {}, tx);

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'subscription.expired',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: sub.id,
            payload: {
              subscriptionId: sub.id,
              userId: sub.userId,
            },
            status: 'PENDING',
          });
        });

        expiredSubscriptionsCount++;
      }
    }

    if (expiredEntitlementsCount > 0 || expiredSubscriptionsCount > 0) {
      this.logger.log(
        `[EntitlementExpirationWorker] Processed expirations: ${expiredEntitlementsCount} entitlements, ${expiredSubscriptionsCount} subscriptions`,
        'EntitlementExpirationWorker'
      );
    }

    return {
      expiredEntitlements: expiredEntitlementsCount,
      expiredSubscriptions: expiredSubscriptionsCount,
    };
  }
}
