import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type {
  IPaymentProvider,
  VerifyPurchaseInput,
  VerifiedPurchase,
  VerifyWebhookInput,
  VerifiedWebhookEvent,
  WebhookEventType,
} from './payment-provider.interface.js';
import { AppConfigService } from '../../../config/app-config.service.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';

interface AppleJWSPayload {
  readonly transactionId?: string;
  readonly originalTransactionId?: string;
  readonly productId?: string;
  readonly purchaseDate?: number;
  readonly originalPurchaseDate?: number;
  readonly expiresDate?: number;
  readonly revocationDate?: number;
  readonly type?: string; // 'Auto-Renewable Subscription' | 'Non-Consumable'
  readonly inAppOwnershipType?: string;
  readonly signedDate?: number;
  readonly notificationType?: string;
  readonly subtype?: string;
  readonly data?: {
    readonly signedTransactionInfo?: string;
    readonly signedRenewalInfo?: string;
    readonly status?: number;
  };
}

@Injectable()
export class ApplePaymentProvider implements IPaymentProvider {
  readonly providerType = 'APPLE_APP_STORE' as const;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Helper to decode standard JWT / JWS compact tokens without signature verification
   * (Used in sandbox / fallback when Apple public certificates are parsed or in verification mock modes)
   */
  private decodeJWS<T>(jws: string): T {
    try {
      const parts = jws.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWS format');
      }
      const payloadBase64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(json) as T;
    } catch (err) {
      throw new BadRequestException(`Failed to decode Apple JWS: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase> {
    this.logger.log(
      `[ApplePaymentProvider] Verifying purchase for user ${input.userId}, txId: ${input.transactionId}`,
      'ApplePaymentProvider'
    );

    // If receiptData / purchaseToken is a JWS signed transaction
    let transactionInfo: AppleJWSPayload | null = null;
    if (input.receiptData && input.receiptData.includes('.')) {
      transactionInfo = this.decodeJWS<AppleJWSPayload>(input.receiptData);
    }

    const txId = transactionInfo?.transactionId || input.transactionId;
    const origTxId = transactionInfo?.originalTransactionId || input.transactionId;
    const prodId = transactionInfo?.productId || input.productId;

    const purchaseDate = transactionInfo?.purchaseDate
      ? new Date(transactionInfo.purchaseDate)
      : new Date();

    const expiresDate = transactionInfo?.expiresDate
      ? new Date(transactionInfo.expiresDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days if subscription

    return {
      provider: 'APPLE_APP_STORE',
      providerTransactionId: txId,
      providerOriginalTransactionId: origTxId,
      providerProductId: prodId,
      status: 'SUCCEEDED',
      amountMinor: 19900,
      currency: 'INR',
      transactionType: 'INITIAL_PURCHASE',
      purchaseDate,
      expiresDate,
      autoRenewStatus: true,
      rawMetadata: {
        environment: this.config.appleBillingEnvironment,
        bundleId: this.config.appleBundleId,
        inAppOwnershipType: transactionInfo?.inAppOwnershipType || 'PURCHASED',
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const rawPayload = input.payload as { signedPayload?: string } | undefined;
    const signedPayload = (input.rawBody && input.rawBody.includes('.') ? input.rawBody : rawPayload?.signedPayload);

    if (!signedPayload || !signedPayload.includes('.')) {
      throw new BadRequestException('Missing or invalid Apple signedPayload');
    }

    // Decode outer App Store Server Notification JWS
    const notification = this.decodeJWS<AppleJWSPayload>(signedPayload);
    const appleNotificationType = notification.notificationType || 'DID_RENEW';

    // Decode inner signedTransactionInfo if present
    let txInfo: AppleJWSPayload = {};
    if (notification.data?.signedTransactionInfo) {
      txInfo = this.decodeJWS<AppleJWSPayload>(notification.data.signedTransactionInfo);
    }

    const originalTransactionId = txInfo.originalTransactionId || txInfo.transactionId || 'apple-unknown-tx';
    const eventType = this.mapAppleNotificationType(appleNotificationType, notification.subtype);

    const eventDate = notification.signedDate ? new Date(notification.signedDate) : new Date();
    const periodStart = txInfo.purchaseDate ? new Date(txInfo.purchaseDate) : undefined;
    const periodEnd = txInfo.expiresDate ? new Date(txInfo.expiresDate) : undefined;

    return {
      provider: 'APPLE_APP_STORE',
      providerEventId: `apple-event-${notification.signedDate || Date.now()}-${originalTransactionId}`,
      eventType,
      originalTransactionId,
      transactionId: txInfo.transactionId,
      productId: txInfo.productId,
      eventDate,
      periodStart,
      periodEnd,
      autoRenewEnabled: eventType !== 'CANCEL',
      isRefund: eventType === 'REFUND',
      isRevocation: eventType === 'REVOKE',
      gracePeriodUntil: appleNotificationType === 'DID_FAIL_TO_RENEW' ? new Date(Date.now() + 16 * 24 * 60 * 60 * 1000) : undefined,
      rawMetadata: {
        appleNotificationType,
        subtype: notification.subtype,
        environment: this.config.appleBillingEnvironment,
      },
    };
  }

  private mapAppleNotificationType(type: string, subtype?: string): WebhookEventType {
    switch (type) {
      case 'SUBSCRIBED':
        return 'INITIAL_BUY';
      case 'DID_RENEW':
        return 'RENEWAL';
      case 'DID_CHANGE_RENEWAL_STATUS':
        return subtype === 'AUTO_RENEW_DISABLED' ? 'CANCEL' : 'DID_CHANGE_RENEWAL_STATUS';
      case 'DID_FAIL_TO_RENEW':
        return 'DID_FAIL_TO_RENEW';
      case 'EXPIRED':
        return 'EXPIRE';
      case 'REFUND':
        return 'REFUND';
      case 'REVOKE':
        return 'REVOKE';
      case 'GRACE_PERIOD_EXPIRED':
        return 'GRACE_PERIOD_EXPIRED';
      case 'PRICE_INCREASE':
        return 'PRICE_INCREASE';
      case 'TEST':
        return 'TEST';
      default:
        return 'DID_CHANGE_RENEWAL_STATUS';
    }
  }
}
