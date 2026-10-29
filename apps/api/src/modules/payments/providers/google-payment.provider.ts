import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';
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
import { assertUnverifiedBillingProcessingAllowed } from './unverified-provider.guard.js';

interface GoogleDeveloperNotification {
  readonly version?: string;
  readonly packageName?: string;
  readonly eventTimeMillis?: string;
  readonly subscriptionNotification?: {
    readonly version?: string;
    readonly notificationType?: number;
    readonly purchaseToken?: string;
    readonly subscriptionId?: string;
  };
  readonly oneTimeProductNotification?: {
    readonly version?: string;
    readonly notificationType?: number;
    readonly purchaseToken?: string;
    readonly sku?: string;
  };
  readonly testNotification?: {
    readonly version?: string;
  };
}

@Injectable()
export class GooglePaymentProvider implements IPaymentProvider {
  readonly providerType = 'GOOGLE_PLAY' as const;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase> {
    // Gate 1A: fail-closed until Gate 1C implements Play Developer API validation
    assertUnverifiedBillingProcessingAllowed(this.config, 'Google Play');

    this.logger.log(
      `[GooglePaymentProvider] Verifying purchase for user ${input.userId}, txId: ${input.transactionId}`,
      'GooglePaymentProvider'
    );

    if (!input.purchaseToken && !input.transactionId) {
      throw new BadRequestException(
        'Google Play purchase verification requires purchaseToken or transactionId'
      );
    }

    const purchaseToken = input.purchaseToken || input.transactionId;
    const orderId = input.transactionId.startsWith('GPA.')
      ? input.transactionId
      : `GPA.${input.transactionId}`;

    const purchaseDate = new Date();
    const expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return {
      provider: 'GOOGLE_PLAY',
      providerTransactionId: orderId,
      providerOriginalTransactionId: orderId,
      providerProductId: input.productId,
      status: 'SUCCEEDED',
      amountMinor: 19900,
      currency: 'INR',
      transactionType: 'INITIAL_PURCHASE',
      purchaseDate,
      expiresDate,
      autoRenewStatus: true,
      rawMetadata: {
        packageName: this.config.googlePlayPackageName,
        purchaseToken,
        orderId,
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const authHeader =
      (input.headers?.['authorization'] as string | undefined) ||
      (input.headers?.['Authorization'] as string | undefined);

    let isGoogleOidcVerified = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const jwks = jose.createRemoteJWKSet(new URL(this.config.googleJwksUrl));
        await jose.jwtVerify(token, jwks, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
        });
        isGoogleOidcVerified = true;
      } catch (err) {
        this.logger.warn(
          `[GooglePaymentProvider] Google Pub/Sub push JWT verification failed: ${err instanceof Error ? err.message : String(err)}`,
          'GooglePaymentProvider'
        );
        throw new UnauthorizedException('Invalid Google Pub/Sub push authentication token');
      }
    }

    // Fail closed if unauthenticated and unverified processing is disabled
    if (!isGoogleOidcVerified && !this.config.billingAllowUnverifiedProviders) {
      assertUnverifiedBillingProcessingAllowed(this.config, 'Google Play');
    }

    const message = (input.payload.message || {}) as {
      data?: string;
      messageId?: string;
      publishTime?: string;
    };
    if (!message.data) {
      throw new BadRequestException('Missing Google Pub/Sub message data');
    }

    let notification: GoogleDeveloperNotification;
    try {
      const decodedJson = Buffer.from(message.data, 'base64').toString('utf8');
      notification = JSON.parse(decodedJson) as GoogleDeveloperNotification;
    } catch (err) {
      throw new BadRequestException(
        `Failed to parse Google RTDN payload: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (
      notification.packageName &&
      notification.packageName !== this.config.googlePlayPackageName
    ) {
      this.logger.warn(
        `[GooglePaymentProvider] Package name mismatch: expected ${this.config.googlePlayPackageName}, got ${notification.packageName}`,
        'GooglePaymentProvider'
      );
      throw new BadRequestException('Google Play notification package name mismatch');
    }

    const eventId = message.messageId || `google-event-${Date.now()}`;
    const eventTime = notification.eventTimeMillis
      ? new Date(Number(notification.eventTimeMillis))
      : message.publishTime
        ? new Date(message.publishTime)
        : new Date();

    const sub = notification.subscriptionNotification;
    const originalTransactionId = sub?.purchaseToken || `google-token-${eventId}`;
    const eventType = this.mapGoogleNotificationType(sub?.notificationType);

    const periodStart = eventTime;
    const periodEnd = new Date(eventTime.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      provider: 'GOOGLE_PLAY',
      providerEventId: eventId,
      eventType,
      originalTransactionId,
      productId: sub?.subscriptionId,
      eventDate: eventTime,
      periodStart,
      periodEnd,
      autoRenewEnabled: eventType !== 'CANCEL',
      isRefund: eventType === 'REFUND',
      isRevocation: eventType === 'REVOKE',
      gracePeriodUntil:
        sub?.notificationType === 6 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
      rawMetadata: {
        packageName: notification.packageName,
        notificationType: sub?.notificationType,
      },
    };
  }

  private mapGoogleNotificationType(type?: number): WebhookEventType {
    switch (type) {
      case 1: // RECOVERED
        return 'RENEWAL';
      case 2: // RENEWED
        return 'RENEWAL';
      case 3: // CANCELED
        return 'CANCEL';
      case 4: // PURCHASED
        return 'INITIAL_BUY';
      case 5: // ON_HOLD
        return 'DID_FAIL_TO_RENEW';
      case 6: // IN_GRACE_PERIOD
        return 'DID_FAIL_TO_RENEW';
      case 7: // RESTARTED
        return 'RENEWAL';
      case 8: // PRICE_CHANGE_CONFIRMED
        return 'PRICE_INCREASE';
      case 9: // DEFERRED
        return 'DID_CHANGE_RENEWAL_STATUS';
      case 10: // PAUSED
        return 'DID_CHANGE_RENEWAL_STATUS';
      case 11: // PAUSE_SCHEDULE_CHANGED
        return 'DID_CHANGE_RENEWAL_STATUS';
      case 12: // REVOKED
        return 'REVOKE';
      case 13: // EXPIRED
        return 'EXPIRE';
      default:
        return 'DID_CHANGE_RENEWAL_STATUS';
    }
  }
}
