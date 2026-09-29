import type {
  BillingWebhookEventRow,
  NewBillingWebhookEventRow,
} from '../../../infrastructure/database/drizzle/schema/billing-webhook-events.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface IBillingWebhookEventsRepository {
  recordEvent(
    data: Omit<NewBillingWebhookEventRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<{ event: BillingWebhookEventRow; isDuplicate: boolean }>;
  findByProviderEventId(
    provider: string,
    providerEventId: string,
    tx?: DrizzleDatabase
  ): Promise<BillingWebhookEventRow | null>;
  claimPendingEvents(limit: number, workerId: string): Promise<readonly BillingWebhookEventRow[]>;
  markProcessed(id: string, tx?: DrizzleDatabase): Promise<boolean>;
  markFailed(
    id: string,
    error: string,
    retryable?: boolean,
    tx?: DrizzleDatabase
  ): Promise<boolean>;
}

export const BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN = 'BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN';
