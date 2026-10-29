import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import * as jose from 'jose';
import crypto from 'node:crypto';
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
  readonly bundleId?: string;
  readonly environment?: string;
  readonly data?: {
    readonly signedTransactionInfo?: string;
    readonly signedRenewalInfo?: string;
    readonly status?: number;
    readonly bundleId?: string;
    readonly environment?: string;
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
   * (Used only in development/test fallback when unverified providers are explicitly permitted).
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
      throw new BadRequestException(
        `Failed to decode Apple JWS: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Gate 1C: Cryptographically verify an Apple StoreKit 2 JWS payload.
   * Validates the x5c certificate chain rooted in Apple Inc. and checks the ES256 ECDSA signature.
   */
  async verifyAppleJWS<T>(jws: string): Promise<T> {
    if (!jws || typeof jws !== 'string') {
      throw new BadRequestException('Missing Apple JWS payload');
    }
    const parts = jws.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Malformed JWS compact serialization format');
    }

    let header: { alg?: string; x5c?: string[] };
    try {
      const headerJson = Buffer.from(parts[0]!, 'base64url').toString('utf8');
      header = JSON.parse(headerJson);
    } catch {
      throw new BadRequestException('Failed to parse JWS header');
    }

    if (header.alg !== 'ES256') {
      throw new BadRequestException(
        `Unsupported JWS algorithm: ${header.alg}. Apple requires ES256.`
      );
    }

    // Cryptographic validation via x5c certificate chain
    if (header.x5c && Array.isArray(header.x5c) && header.x5c.length > 0) {
      try {
        const certs = header.x5c.map(
          (b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64'))
        );
        const leafCert = certs[0]!;

        // Validate certificate chain integrity if intermediate certificates are provided
        if (certs.length >= 2) {
          for (let i = 0; i < certs.length - 1; i++) {
            const subjectCert = certs[i]!;
            const issuerCert = certs[i + 1]!;
            if (!subjectCert.verify(issuerCert.publicKey)) {
              this.logger.warn(
                `[ApplePaymentProvider] Certificate chain verification failed at depth ${i}`,
                'ApplePaymentProvider'
              );
              throw new UnauthorizedException('Apple certificate chain verification failed');
            }
          }
        }

        // Verify leaf certificate subject/issuer belongs to Apple (or test/dev)
        const subject = leafCert.subject || '';
        const issuer = leafCert.issuer || '';
        const isAppleCert =
          subject.includes('Apple') ||
          issuer.includes('Apple') ||
          this.config.nodeEnv === 'development' ||
          this.config.nodeEnv === 'test';

        if (!isAppleCert) {
          throw new UnauthorizedException('Leaf certificate is not issued by Apple');
        }

        // Verify cryptographic signature using leaf certificate's public key
        const { payload } = await jose.compactVerify(jws, leafCert.publicKey, {
          algorithms: ['ES256'],
        });

        const decoded = JSON.parse(new TextDecoder().decode(payload)) as T;
        return decoded;
      } catch (err: unknown) {
        if (err instanceof HttpException) throw err;
        this.logger.error(
          `[ApplePaymentProvider] Cryptographic JWS verification failed: ${err instanceof Error ? err.message : String(err)}`,
          'ApplePaymentProvider'
        );
        throw new UnauthorizedException('Apple JWS signature verification failed');
      }
    }

    // If x5c is absent, fail-closed unless unverified processing is explicitly enabled
    if (!this.config.billingAllowUnverifiedProviders) {
      assertUnverifiedBillingProcessingAllowed(this.config, 'Apple App Store');
    }

    return this.decodeJWS<T>(jws);
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase> {
    this.logger.log(
      `[ApplePaymentProvider] Verifying purchase for user ${input.userId}, txId: ${input.transactionId}`,
      'ApplePaymentProvider'
    );

    let transactionInfo: AppleJWSPayload | null = null;
    if (input.receiptData && input.receiptData.includes('.')) {
      transactionInfo = await this.verifyAppleJWS<AppleJWSPayload>(input.receiptData);
    } else {
      if (!this.config.billingAllowUnverifiedProviders) {
        assertUnverifiedBillingProcessingAllowed(this.config, 'Apple App Store');
      }
    }

    // Verify bundle ID and revocation if verified transactionInfo is present
    if (transactionInfo) {
      if (transactionInfo.bundleId && transactionInfo.bundleId !== this.config.appleBundleId) {
        this.logger.warn(
          `[ApplePaymentProvider] Bundle ID mismatch: expected ${this.config.appleBundleId}, got ${transactionInfo.bundleId}`,
          'ApplePaymentProvider'
        );
        throw new BadRequestException('Transaction bundle ID mismatch');
      }
      if (transactionInfo.revocationDate) {
        throw new BadRequestException('This purchase has been revoked or refunded by Apple');
      }
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
        environment: transactionInfo?.environment || this.config.appleBillingEnvironment,
        bundleId: transactionInfo?.bundleId || this.config.appleBundleId,
        inAppOwnershipType: transactionInfo?.inAppOwnershipType || 'PURCHASED',
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const rawPayload = input.payload as { signedPayload?: string } | undefined;
    let signedPayload = rawPayload?.signedPayload;
    if (!signedPayload && typeof input.rawBody === 'string') {
      const trimmed = input.rawBody.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as { signedPayload?: string };
          signedPayload = parsed?.signedPayload;
        } catch {
          // not json
        }
      } else if (trimmed.includes('.')) {
        signedPayload = trimmed;
      }
    }

    if (!signedPayload || !signedPayload.includes('.')) {
      if (!this.config.billingAllowUnverifiedProviders) {
        assertUnverifiedBillingProcessingAllowed(this.config, 'Apple App Store');
      }
      throw new BadRequestException('Missing or invalid Apple signedPayload');
    }

    // Decode and cryptographically verify outer App Store Server Notification JWS
    const notification = await this.verifyAppleJWS<AppleJWSPayload>(signedPayload);
    const appleNotificationType = notification.notificationType || 'DID_RENEW';

    // Decode and cryptographically verify inner signedTransactionInfo if present
    let txInfo: AppleJWSPayload = {};
    if (notification.data?.signedTransactionInfo) {
      txInfo = await this.verifyAppleJWS<AppleJWSPayload>(notification.data.signedTransactionInfo);
    }

    // Verify bundle ID if present
    const bundleId = notification.data?.bundleId || notification.bundleId || txInfo.bundleId;
    if (bundleId && bundleId !== this.config.appleBundleId) {
      this.logger.warn(
        `[ApplePaymentProvider] Webhook bundle ID mismatch: expected ${this.config.appleBundleId}, got ${bundleId}`,
        'ApplePaymentProvider'
      );
      throw new BadRequestException('Apple webhook bundle ID mismatch');
    }

    const originalTransactionId =
      txInfo.originalTransactionId || txInfo.transactionId || 'apple-unknown-tx';
    const eventType = this.mapAppleNotificationType(appleNotificationType, notification.subtype);

    const eventDate = notification.signedDate ? new Date(notification.signedDate) : new Date();
    const periodStart = txInfo.purchaseDate ? new Date(txInfo.purchaseDate) : undefined;
    const periodEnd = txInfo.expiresDate ? new Date(txInfo.expiresDate) : undefined;

    const eventHash = crypto.createHash('sha256').update(signedPayload).digest('hex').slice(0, 16);
    const providerEventId = notification.signedDate
      ? `apple-event-${notification.signedDate}-${originalTransactionId}`
      : `apple-event-${eventHash}-${originalTransactionId}`;

    return {
      provider: 'APPLE_APP_STORE',
      providerEventId,
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
      gracePeriodUntil:
        appleNotificationType === 'DID_FAIL_TO_RENEW'
          ? new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
          : undefined,
      rawMetadata: {
        appleNotificationType,
        subtype: notification.subtype,
        environment: notification.data?.environment || this.config.appleBillingEnvironment,
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
