import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lte, desc } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import {
  subscriptions,
  type SubscriptionRow,
  type NewSubscriptionRow,
} from '../../../infrastructure/database/drizzle/schema/subscriptions.js';
import type { ISubscriptionsRepository } from './subscriptions.repository.interface.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class SubscriptionsRepository implements ISubscriptionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async findByUserId(userId: string, tx?: DrizzleDatabase): Promise<readonly SubscriptionRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<SubscriptionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    return row || null;
  }

  async findByProviderOriginalTransactionId(
    provider: string,
    originalTransactionId: string,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.provider, provider),
          eq(subscriptions.providerOriginalTransactionId, originalTransactionId)
        )
      )
      .limit(1);

    return row || null;
  }

  async upsertSubscription(
    data: Omit<NewSubscriptionRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow> {
    const client = this.getClient(tx);
    const now = new Date();

    const [existing] = await client
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.provider, data.provider),
          eq(subscriptions.providerOriginalTransactionId, data.providerOriginalTransactionId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await client
        .update(subscriptions)
        .set({
          userId: data.userId, // supports subscription restore/reassignment if ownership transferred
          productId: data.productId,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          expiresAt: data.expiresAt,
          cancelledAt: data.cancelledAt,
          autoRenewEnabled: data.autoRenewEnabled,
          gracePeriodUntil: data.gracePeriodUntil,
          providerSubscriptionId: data.providerSubscriptionId || existing.providerSubscriptionId,
          metadata: data.metadata || existing.metadata,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();

      return updated!;
    }

    const subId = generateUuidV7();
    const [created] = await client
      .insert(subscriptions)
      .values({
        id: subId,
        userId: data.userId,
        productId: data.productId,
        provider: data.provider,
        providerSubscriptionId: data.providerSubscriptionId,
        providerOriginalTransactionId: data.providerOriginalTransactionId,
        status: data.status || 'ACTIVE',
        startedAt: data.startedAt || now,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelledAt: data.cancelledAt,
        expiresAt: data.expiresAt,
        autoRenewEnabled: data.autoRenewEnabled ?? true,
        gracePeriodUntil: data.gracePeriodUntil,
        metadata: data.metadata || {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created!;
  }

  async updateStatus(
    id: string,
    status: SubscriptionRow['status'],
    updates?: Partial<Omit<NewSubscriptionRow, 'id' | 'createdAt' | 'userId' | 'productId' | 'provider'>>,
    tx?: DrizzleDatabase
  ): Promise<SubscriptionRow> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(subscriptions)
      .set({
        status,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    return updated!;
  }

  async findExpiredActiveSubscriptions(asOf: Date = new Date(), tx?: DrizzleDatabase): Promise<readonly SubscriptionRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'ACTIVE'),
          lte(subscriptions.expiresAt, asOf)
        )
      )
      .limit(100);
  }
}
