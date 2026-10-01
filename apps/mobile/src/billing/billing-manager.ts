import { Platform } from 'react-native';
import type {
  PaymentProviderType,
  UserEntitlementDto,
  EntitlementCode,
  PurchaseVerificationResultDto,
  RestorePurchasesResultDto,
} from '@platform/api-contracts';
import type { BillingApiClient } from './billing-api.js';
import { getMobileConfig } from '../config/mobile-config.js';

export class BillingManager {
  private client: BillingApiClient | null = null;
  private cachedEntitlements: UserEntitlementDto[] = [];
  private hasPremiumStatus: boolean = false;

  initialize(client: BillingApiClient): void {
    this.client = client;
  }

  getNativeProvider(): PaymentProviderType {
    const os = typeof Platform !== 'undefined' && Platform?.OS ? Platform.OS : 'web';
    if (os === 'ios') {
      return 'APPLE_APP_STORE';
    }
    if (os === 'android') {
      return 'GOOGLE_PLAY';
    }
    return 'MOCK';
  }

  async refreshEntitlements(): Promise<UserEntitlementDto[]> {
    if (!this.client) {
      return [];
    }

    try {
      const res = await this.client.getEntitlements();
      this.cachedEntitlements = [...res.entitlements];
      this.hasPremiumStatus = res.hasPremium;
      return this.cachedEntitlements;
    } catch {
      return this.cachedEntitlements;
    }
  }

  hasEntitlement(code: EntitlementCode): boolean {
    const now = new Date();
    return this.cachedEntitlements.some(
      (e) => e.code === code && e.active && (!e.expiresAt || new Date(e.expiresAt) > now)
    );
  }

  isPremium(): boolean {
    return this.hasPremiumStatus || this.hasEntitlement('PREMIUM');
  }

  async purchaseProduct(
    productId: string,
    mockToken?: string
  ): Promise<PurchaseVerificationResultDto> {
    if (!this.client) {
      throw new Error('BillingManager is not initialized with an API client');
    }

    const provider = this.getNativeProvider();
    const transactionId = mockToken || `tx-${Platform.OS}-${Date.now()}`;
    let environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX';
    try {
      environment = getMobileConfig().EXPO_PUBLIC_APP_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    } catch {
      environment = 'SANDBOX';
    }

    // Server-authoritative purchase verification
    const result = await this.client.verifyPurchase({
      provider,
      productId,
      transactionId,
      purchaseToken: transactionId,
      environment,
    });

    // Update cached entitlements
    this.cachedEntitlements = [...result.effectiveEntitlements];
    this.hasPremiumStatus = this.hasEntitlement('PREMIUM');

    return result;
  }

  async restorePurchases(receiptOrToken?: string): Promise<RestorePurchasesResultDto> {
    if (!this.client) {
      throw new Error('BillingManager is not initialized with an API client');
    }

    const provider = this.getNativeProvider();
    let environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX';
    try {
      environment = getMobileConfig().EXPO_PUBLIC_APP_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    } catch {
      environment = 'SANDBOX';
    }

    const result = await this.client.restorePurchases({
      provider,
      receiptData: receiptOrToken,
      purchaseTokens: receiptOrToken ? [receiptOrToken] : [],
      environment,
    });

    this.cachedEntitlements = [...result.effectiveEntitlements];
    this.hasPremiumStatus = this.hasEntitlement('PREMIUM');

    return result;
  }

  clearCache(): void {
    this.cachedEntitlements = [];
    this.hasPremiumStatus = false;
  }

  getManagementUrl(provider?: PaymentProviderType): string {
    if (provider === 'APPLE_APP_STORE') {
      return 'https://apps.apple.com/account/subscriptions';
    }
    if (provider === 'GOOGLE_PLAY') {
      return 'https://play.google.com/store/account/subscriptions';
    }
    const os = typeof Platform !== 'undefined' && Platform?.OS ? Platform.OS : 'web';
    if (os === 'ios') {
      return 'https://apps.apple.com/account/subscriptions';
    }
    if (os === 'android') {
      return 'https://play.google.com/store/account/subscriptions';
    }
    return 'https://play.google.com/store/account/subscriptions';
  }
}

export const billingManager = new BillingManager();
