export type PaymentProviderType = 'APPLE_APP_STORE' | 'GOOGLE_PLAY' | 'MOCK';

export type ProductType = 'SUBSCRIPTION' | 'ONE_TIME' | 'CONSUMABLE' | 'NON_CONSUMABLE';

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'REFUNDED';

export type TransactionType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'RESTORE'
  | 'REFUND'
  | 'REVOCATION'
  | 'RENEWAL_FAILURE';

export type TransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'DISPUTED';

export type EntitlementCode =
  | 'PREMIUM'
  | 'SEE_LIKES'
  | 'UNLIMITED_LIKES'
  | 'ADVANCED_DISCOVERY'
  | 'PROFILE_BOOST'
  | 'UNLIMITED_REWINDS';

export type EntitlementSourceType =
  | 'SUBSCRIPTION'
  | 'ONE_TIME_PURCHASE'
  | 'PROMOTION'
  | 'ADMIN_GRANT'
  | 'SYSTEM';

export type EntitlementStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type WebhookStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export interface ProductResponseDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly productType: ProductType;
  readonly durationDays: number | null;
  readonly basePriceMinor: number;
  readonly baseCurrency: string;
  readonly formattedPrice?: string;
  readonly providerProductIds: Record<string, string>; // provider -> providerProductId
  readonly grantedEntitlements: readonly EntitlementCode[];
}

export interface ProductListResponseDto {
  readonly products: readonly ProductResponseDto[];
}

export interface VerifyPurchaseRequestDto {
  readonly provider: PaymentProviderType;
  readonly productId: string; // Internal product code OR provider product ID
  readonly transactionId: string;
  readonly purchaseToken?: string;
  readonly receiptData?: string;
  readonly environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface RestorePurchasesRequestDto {
  readonly provider: PaymentProviderType;
  readonly receiptData?: string;
  readonly purchaseTokens?: readonly string[];
  readonly environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface UserEntitlementDto {
  readonly code: EntitlementCode;
  readonly active: boolean;
  readonly startsAt: string;
  readonly expiresAt: string | null;
  readonly sourceType: EntitlementSourceType;
}

export interface PurchaseVerificationResultDto {
  readonly verified: boolean;
  readonly subscription?: SubscriptionResponseDto;
  readonly transaction: PaymentTransactionResponseDto;
  readonly effectiveEntitlements: readonly UserEntitlementDto[];
}

export interface RestorePurchasesResultDto {
  readonly restoredCount: number;
  readonly effectiveEntitlements: readonly UserEntitlementDto[];
  readonly subscriptions: readonly SubscriptionResponseDto[];
}

export interface EntitlementsListResponseDto {
  readonly entitlements: readonly UserEntitlementDto[];
  readonly hasPremium: boolean;
}

export interface SubscriptionResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly productId: string;
  readonly productCode: string;
  readonly provider: PaymentProviderType;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelledAt: string | null;
  readonly expiresAt: string | null;
  readonly autoRenewEnabled: boolean;
  readonly gracePeriodUntil: string | null;
  readonly createdAt: string;
}

export interface SubscriptionListResponseDto {
  readonly subscriptions: readonly SubscriptionResponseDto[];
}

export interface PaymentTransactionResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly productId: string;
  readonly productCode: string;
  readonly subscriptionId: string | null;
  readonly provider: PaymentProviderType;
  readonly transactionType: TransactionType;
  readonly status: TransactionStatus;
  readonly amountMinor: number;
  readonly currency: string;
  readonly providerCreatedAt: string | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}

export interface PaymentTransactionListResponseDto {
  readonly transactions: readonly PaymentTransactionResponseDto[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface AppleWebhookRequestDto {
  readonly signedPayload: string;
}

export interface GoogleWebhookMessage {
  readonly data: string;
  readonly messageId: string;
  readonly publishTime: string;
}

export interface GoogleWebhookRequestDto {
  readonly message: GoogleWebhookMessage;
  readonly subscription: string;
}

export interface WebhookAcknowledgementDto {
  readonly received: boolean;
  readonly duplicate?: boolean;
  readonly eventId?: string;
}
