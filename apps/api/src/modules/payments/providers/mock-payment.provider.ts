import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  IPaymentProvider,
  VerifyPurchaseInput,
  VerifiedPurchase,
  VerifyWebhookInput,
  VerifiedWebhookEvent,
  WebhookEventType,
} from './payment-provider.interface.js';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly providerType = 'MOCK' as const;

  private readonly verifiedPurchases: VerifyPurchaseInput[] = [];
  private readonly verifiedWebhooks: VerifyWebhookInput[] = [];

  // Configuration toggles for tests
  public shouldFailVerification = false;
  public shouldFailWebhook = false;
  public mockExpiredSubscription = false;
  public mockRevokedSubscription = false;
  public mockGracePeriod = false;
  public mockAmountMinor = 19900;
  public mockCurrency = 'INR';

  clear(): void {
    this.verifiedPurchases.length = 0;
    this.verifiedWebhooks.length = 0;
    this.shouldFailVerification = false;
    this.shouldFailWebhook = false;
    this.mockExpiredSubscription = false;
    this.mockRevokedSubscription = false;
    this.mockGracePeriod = false;
    this.mockAmountMinor = 19900;
    this.mockCurrency = 'INR';
  }

  getVerifiedPurchases(): readonly VerifyPurchaseInput[] {
    return [...this.verifiedPurchases];
  }

  getVerifiedWebhooks(): readonly VerifyWebhookInput[] {
    return [...this.verifiedWebhooks];
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase> {
    this.verifiedPurchases.push(input);

    if (
      this.shouldFailVerification ||
      input.transactionId.includes('invalid') ||
      input.purchaseToken?.includes('invalid')
    ) {
      throw new BadRequestException(
        'Mock purchase verification failed: Invalid transaction or token'
      );
    }

    const now = new Date();
    const expiresDate = this.mockExpiredSubscription
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000) // expired yesterday
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // active for 30 days

    const origTxId = input.transactionId.replace(/^renew_/, '').replace(/^restore_/, '');

    return {
      provider: input.provider,
      providerTransactionId: input.transactionId,
      providerOriginalTransactionId: origTxId,
      providerProductId: input.productId,
      status: this.mockRevokedSubscription ? 'FAILED' : 'SUCCEEDED',
      amountMinor: this.mockAmountMinor,
      currency: this.mockCurrency,
      transactionType: input.transactionId.startsWith('renew_')
        ? 'RENEWAL'
        : input.transactionId.startsWith('restore_')
          ? 'RESTORE'
          : 'INITIAL_PURCHASE',
      purchaseDate: now,
      expiresDate,
      autoRenewStatus: !this.mockExpiredSubscription && !this.mockRevokedSubscription,
      rawMetadata: {
        mock: true,
        receipt: input.receiptData,
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    this.verifiedWebhooks.push(input);

    if (this.shouldFailWebhook || input.rawBody.includes('invalid_signature')) {
      throw new BadRequestException('Mock webhook signature verification failed');
    }

    const payload = input.payload as {
      eventId?: string;
      eventType?: WebhookEventType;
      originalTransactionId?: string;
      transactionId?: string;
      productId?: string;
      eventTime?: string;
      periodEnd?: string;
      isRefund?: boolean;
      isRevocation?: boolean;
    };

    const eventId = payload.eventId || `mock-evt-${Date.now()}`;
    const eventType = payload.eventType || 'RENEWAL';
    const origTxId = payload.originalTransactionId || 'mock-orig-tx-123';
    const eventDate = payload.eventTime ? new Date(payload.eventTime) : new Date();

    const periodEnd = payload.periodEnd
      ? new Date(payload.periodEnd)
      : new Date(eventDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      provider: input.provider,
      providerEventId: eventId,
      eventType,
      originalTransactionId: origTxId,
      transactionId: payload.transactionId || `mock-tx-${eventId}`,
      productId: payload.productId || 'PREMIUM_MONTHLY',
      eventDate,
      periodStart: eventDate,
      periodEnd,
      autoRenewEnabled: eventType !== 'CANCEL',
      isRefund: payload.isRefund || eventType === 'REFUND',
      isRevocation: payload.isRevocation || eventType === 'REVOKE',
      gracePeriodUntil:
        eventType === 'DID_FAIL_TO_RENEW'
          ? new Date(eventDate.getTime() + 16 * 24 * 60 * 60 * 1000)
          : undefined,
      rawMetadata: {
        mock: true,
        source: input.provider,
      },
    };
  }
}
