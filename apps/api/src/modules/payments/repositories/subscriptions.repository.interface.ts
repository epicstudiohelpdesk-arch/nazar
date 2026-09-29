import type {
  SubscriptionRow,
  NewSubscriptionRow,
} from '../../../infrastructure/database/drizzle/schema/subscriptions.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface ISubscriptionsRepository {
  findByUserId(userId: string, tx?: DrizzleDatabase): Promise<readonly SubscriptionRow[]>;
  findById(id: string, tx?: DrizzleDatabase): Promise<SubscriptionRow | null>;
  findByProviderOriginalTransactionId(
    provider: string,
    originalTransactionId: string,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow | null>;
  upsertSubscription(
    data: Omit<NewSubscriptionRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow>;
  updateStatus(
    id: string,
    status: SubscriptionRow['status'],
    updates?: Partial<Omit<NewSubscriptionRow, 'id' | 'createdAt' | 'userId' | 'productId' | 'provider'>>,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow>;
  findExpiredActiveSubscriptions(asOf?: Date, tx?: DrizzleDatabase): Promise<readonly SubscriptionRow[]>;
}

export const SUBSCRIPTIONS_REPOSITORY_TOKEN = 'SUBSCRIPTIONS_REPOSITORY_TOKEN';
