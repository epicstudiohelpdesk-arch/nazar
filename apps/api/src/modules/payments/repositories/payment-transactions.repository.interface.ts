import type {
  PaymentTransactionRow,
  NewPaymentTransactionRow,
} from '../../../infrastructure/database/drizzle/schema/payment-transactions.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface ListTransactionsOptions {
  readonly limit: number;
  readonly cursor?: {
    readonly createdAt: Date;
    readonly id: string;
  };
}

export interface IPaymentTransactionsRepository {
  createTransaction(
    data: Omit<NewPaymentTransactionRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<PaymentTransactionRow>;
  findByProviderTransactionId(
    provider: string,
    transactionId: string,
    tx?: DrizzleDatabase
  ): Promise<PaymentTransactionRow | null>;
  findById(id: string, tx?: DrizzleDatabase): Promise<PaymentTransactionRow | null>;
  findByUserId(
    userId: string,
    options: ListTransactionsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly PaymentTransactionRow[]>;
}

export const PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN = 'PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN';
