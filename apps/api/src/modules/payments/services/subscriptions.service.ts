import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  SUBSCRIPTIONS_REPOSITORY_TOKEN,
  type ISubscriptionsRepository,
} from '../repositories/subscriptions.repository.interface.js';
import {
  PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN,
  type IPaymentTransactionsRepository,
} from '../repositories/payment-transactions.repository.interface.js';
import {
  PRODUCTS_REPOSITORY_TOKEN,
  type IProductsRepository,
} from '../repositories/products.repository.interface.js';
import {
  ErrorCode,
  type SubscriptionResponseDto,
  type PaymentTransactionResponseDto,
  type PaymentTransactionListResponseDto,
} from '@platform/api-contracts';
import type { SubscriptionRow } from '../../../infrastructure/database/drizzle/schema/subscriptions.js';
import type { PaymentTransactionRow } from '../../../infrastructure/database/drizzle/schema/payment-transactions.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY_TOKEN)
    private readonly subscriptionsRepo: ISubscriptionsRepository,
    @Inject(PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN)
    private readonly transactionsRepo: IPaymentTransactionsRepository,
    @Inject(PRODUCTS_REPOSITORY_TOKEN)
    private readonly productsRepo: IProductsRepository
  ) {}

  async getUserSubscriptions(userId: string): Promise<readonly SubscriptionResponseDto[]> {
    const rows = await this.subscriptionsRepo.findByUserId(userId);
    const dtos: SubscriptionResponseDto[] = [];

    for (const row of rows) {
      const product = await this.productsRepo.findById(row.productId);
      dtos.push(this.toSubscriptionDto(row, product?.code || 'UNKNOWN'));
    }

    return dtos;
  }

  async getSubscriptionById(userId: string, subscriptionId: string): Promise<SubscriptionResponseDto> {
    const row = await this.subscriptionsRepo.findById(subscriptionId);
    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.SUBSCRIPTION_NOT_FOUND,
        message: 'Subscription not found',
      });
    }

    if (row.userId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.SUBSCRIPTION_ACCESS_DENIED,
        message: 'You do not have access to this subscription',
      });
    }

    const product = await this.productsRepo.findById(row.productId);
    return this.toSubscriptionDto(row, product?.code || 'UNKNOWN');
  }

  async getUserTransactions(
    userId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<PaymentTransactionListResponseDto> {
    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const lastColon = decoded.lastIndexOf(':');
        if (lastColon > 0) {
          const timeStr = decoded.slice(0, lastColon);
          const id = decoded.slice(lastColon + 1);
          const parsedDate = new Date(timeStr);
          if (!isNaN(parsedDate.getTime()) && id) {
            parsedCursor = { createdAt: parsedDate, id };
          }
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const rows = await this.transactionsRepo.findByUserId(userId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const transactions: PaymentTransactionResponseDto[] = [];
    for (const row of resultRows) {
      const product = await this.productsRepo.findById(row.productId);
      transactions.push(this.toTransactionDto(row, product?.code || 'UNKNOWN'));
    }

    let nextCursor: string | null = null;
    if (hasMore && resultRows.length > 0) {
      const last = resultRows[resultRows.length - 1]!;
      nextCursor = Buffer.from(`${last.createdAt.toISOString()}:${last.id}`).toString('base64');
    }

    return {
      transactions,
      nextCursor,
      hasMore,
    };
  }

  private toSubscriptionDto(row: SubscriptionRow, productCode: string): SubscriptionResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      productCode,
      provider: row.provider as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: row.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      startedAt: row.startedAt.toISOString(),
      currentPeriodStart: row.currentPeriodStart.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      autoRenewEnabled: row.autoRenewEnabled,
      gracePeriodUntil: row.gracePeriodUntil ? row.gracePeriodUntil.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toTransactionDto(
    row: PaymentTransactionRow,
    productCode: string
  ): PaymentTransactionResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      productCode,
      subscriptionId: row.subscriptionId,
      provider: row.provider as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      transactionType: row.transactionType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: row.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      amountMinor: row.amountMinor,
      currency: row.currency,
      providerCreatedAt: row.providerCreatedAt ? row.providerCreatedAt.toISOString() : null,
      verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
