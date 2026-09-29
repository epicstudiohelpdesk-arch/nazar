import type { PaymentProviderType, TransactionType } from '@platform/api-contracts';

export interface VerifyPurchaseInput {
  readonly userId: string;
  readonly provider: PaymentProviderType;
  readonly productId: string; // Internal product code OR provider product ID
  readonly transactionId: string;
  readonly purchaseToken?: string;
  readonly receiptData?: string;
  readonly environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface VerifiedPurchase {
  readonly provider: PaymentProviderType;
  readonly providerTransactionId: string;
  readonly providerOriginalTransactionId: string;
  readonly providerProductId: string;
  readonly status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  readonly amountMinor: number;
  readonly currency: string;
  readonly transactionType: TransactionType;
  readonly purchaseDate: Date;
  readonly expiresDate?: Date | null;
  readonly autoRenewStatus?: boolean;
  readonly isTrial?: boolean;
  readonly rawMetadata?: Record<string, unknown>;
}

export type WebhookEventType =
  | 'INITIAL_BUY'
  | 'RENEWAL'
  | 'DID_CHANGE_RENEWAL_STATUS'
  | 'DID_FAIL_TO_RENEW'
  | 'CANCEL'
  | 'EXPIRE'
  | 'REFUND'
  | 'REVOKE'
  | 'GRACE_PERIOD_EXPIRED'
  | 'PRICE_INCREASE'
  | 'TEST';

export interface VerifyWebhookInput {
  readonly provider: PaymentProviderType;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBody: string;
  readonly payload: Record<string, unknown>;
}

export interface VerifiedWebhookEvent {
  readonly provider: PaymentProviderType;
  readonly providerEventId: string;
  readonly eventType: WebhookEventType;
  readonly originalTransactionId: string;
  readonly transactionId?: string;
  readonly productId?: string;
  readonly eventDate: Date;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly autoRenewEnabled?: boolean;
  readonly isRefund?: boolean;
  readonly isRevocation?: boolean;
  readonly gracePeriodUntil?: Date;
  readonly rawMetadata?: Record<string, unknown>;
}

export interface IPaymentProvider {
  readonly providerType: PaymentProviderType;
  verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;
  getSubscription?(originalTransactionId: string): Promise<VerifiedPurchase | null>;
}

export const APPLE_PAYMENT_PROVIDER_TOKEN = 'APPLE_PAYMENT_PROVIDER_TOKEN';
export const GOOGLE_PAYMENT_PROVIDER_TOKEN = 'GOOGLE_PAYMENT_PROVIDER_TOKEN';
export const MOCK_PAYMENT_PROVIDER_TOKEN = 'MOCK_PAYMENT_PROVIDER_TOKEN';
export const PAYMENT_PROVIDER_FACTORY_TOKEN = 'PAYMENT_PROVIDER_FACTORY_TOKEN';
