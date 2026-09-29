import { Injectable, Inject } from '@nestjs/common';
import {
  BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN,
  type IBillingWebhookEventsRepository,
} from '../repositories/billing-webhook-events.repository.interface.js';
import { BillingWebhookService } from '../services/billing-webhook.service.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class BillingWebhookConsumer {
  constructor(
    @Inject(BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN)
    private readonly webhookRepo: IBillingWebhookEventsRepository,
    @Inject(BillingWebhookService)
    private readonly webhookService: BillingWebhookService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Process a batch of pending webhook events atomically claimed via FOR UPDATE SKIP LOCKED.
   */
  async processPendingWebhooks(
    limit: number = 20,
    workerId: string = `webhook-worker-${generateUuidV7()}`
  ): Promise<number> {
    const events = await this.webhookRepo.claimPendingEvents(limit, workerId);
    if (events.length === 0) {
      return 0;
    }

    let processedCount = 0;
    for (const event of events) {
      try {
        await this.webhookService.processWebhookEvent(event);
        await this.webhookRepo.markProcessed(event.id);
        processedCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[BillingWebhookConsumer] Error processing event ${event.id}: ${errorMsg}`,
          undefined,
          'BillingWebhookConsumer'
        );
        await this.webhookRepo.markFailed(event.id, errorMsg, true);
      }
    }

    return processedCount;
  }
}
