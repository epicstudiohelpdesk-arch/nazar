import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  paymentTransactions,
  type PaymentTransactionRow,
  type NewPaymentTransactionRow,
} from '../../../infrastructure/database/drizzle/schema/payment-transactions.js';
import type {
  IPaymentTransactionsRepository,
  ListTransactionsOptions,
} from './payment-transactions.repository.interface.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class PaymentTransactionsRepository implements IPaymentTransactionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createTransaction(
    data: Omit<NewPaymentTransactionRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<PaymentTransactionRow> {
    const client = this.getClient(tx);
    const now = new Date();
    const id = generateUuidV7();

    const [row] = await client
      .insert(paymentTransactions)
      .values({
        id,
        userId: data.userId,
        productId: data.productId,
        subscriptionId: data.subscriptionId,
        provider: data.provider,
        providerTransactionId: data.providerTransactionId,
        providerOriginalTransactionId: data.providerOriginalTransactionId,
        transactionType: data.transactionType,
        status: data.status || 'PENDING',
        amountMinor: data.amountMinor,
        currency: data.currency,
        providerCreatedAt: data.providerCreatedAt,
        verifiedAt: data.verifiedAt,
        providerMetadata: data.providerMetadata || {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return row!;
  }

  async findByProviderTransactionId(
    provider: string,
    transactionId: string,
    tx?: DrizzleDatabase
  ): Promise<PaymentTransactionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.provider, provider),
          eq(paymentTransactions.providerTransactionId, transactionId)
        )
      )
      .limit(1);

    return row || null;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<PaymentTransactionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id))
      .limit(1);

    return row || null;
  }

  async findByUserId(
    userId: string,
    options: ListTransactionsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly PaymentTransactionRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${paymentTransactions.createdAt} < ${options.cursor.createdAt} OR (${paymentTransactions.createdAt} = ${options.cursor.createdAt} AND ${paymentTransactions.id} < ${options.cursor.id}))`;
    }

    return client
      .select()
      .from(paymentTransactions)
      .where(and(eq(paymentTransactions.userId, userId), cursorCondition))
      .orderBy(desc(paymentTransactions.createdAt), desc(paymentTransactions.id))
      .limit(options.limit);
  }
}
