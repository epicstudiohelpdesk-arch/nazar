import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { BillingApiClient, BILLING_QUERY_KEYS } from '../src/billing/billing-api.js';
import { BillingManager } from '../src/billing/billing-manager.js';
import { clearBillingCaches, invalidateBillingCaches } from '../src/billing/useEntitlements.js';
import { sanitizeAnalyticsProperties } from '../src/analytics/onboarding-analytics.js';
import type {
  ProductListResponseDto,
  PurchaseVerificationResultDto,
  EntitlementsListResponseDto,
  RestorePurchasesResultDto,
  PaymentTransactionListResponseDto,
  SubscriptionDto,
} from '@platform/api-contracts';

describe('Mobile Billing Architecture (Gate 11)', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let apiClient: BillingApiClient;
  let billingManager: BillingManager;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    apiClient = new BillingApiClient({
      baseUrl: 'http://localhost:3000',
      getAccessToken: async () => 'test-token-123',
    });

    billingManager = new BillingManager();
    billingManager.initialize(apiClient);
  });

  it('lists active products and subscription plans via API client', async () => {
    const mockProducts: ProductListResponseDto = {
      products: [
        {
          id: 'prod-1',
          code: 'PREMIUM_MONTHLY',
          name: 'Nazar Premium Monthly',
          description: 'Unlimited likes and filters',
          productType: 'SUBSCRIPTION',
          durationDays: 30,
          basePriceMinor: 19900,
          baseCurrency: 'INR',
          formattedPrice: '₹199',
          providerProductIds: { APPLE_APP_STORE: 'com.nazar.premium.monthly' },
          grantedEntitlements: ['PREMIUM', 'SEE_LIKES', 'UNLIMITED_LIKES'],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProducts }),
    });

    const res = await apiClient.listProducts();

    expect(res.products).toHaveLength(1);
    expect(res.products[0]!.code).toBe('PREMIUM_MONTHLY');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/billing/products',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      })
    );
  });

  it('submits purchase for server-side verification and updates local state', async () => {
    const mockVerifyResult: PurchaseVerificationResultDto = {
      verified: true,
      subscription: {
        id: 'sub-1',
        userId: 'user-1',
        productId: 'prod-1',
        productCode: 'PREMIUM_MONTHLY',
        provider: 'APPLE_APP_STORE',
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelledAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenewEnabled: true,
        gracePeriodUntil: null,
        createdAt: new Date().toISOString(),
      },
      transaction: {
        id: 'tx-1',
        userId: 'user-1',
        productId: 'prod-1',
        productCode: 'PREMIUM_MONTHLY',
        subscriptionId: 'sub-1',
        provider: 'APPLE_APP_STORE',
        transactionType: 'INITIAL_PURCHASE',
        status: 'SUCCEEDED',
        amountMinor: 19900,
        currency: 'INR',
        providerCreatedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      effectiveEntitlements: [
        {
          code: 'PREMIUM',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
        {
          code: 'SEE_LIKES',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockVerifyResult }),
    });

    const result = await billingManager.purchaseProduct('PREMIUM_MONTHLY', 'mock-apple-tx-id');

    expect(result.verified).toBe(true);
    expect(billingManager.hasEntitlement('PREMIUM')).toBe(true);
    expect(billingManager.hasEntitlement('SEE_LIKES')).toBe(true);
    expect(billingManager.isPremium()).toBe(true);
  });

  it('determines entitlement status time-aware: returns false when expired', async () => {
    const expiredResult: EntitlementsListResponseDto = {
      entitlements: [
        {
          code: 'PREMIUM',
          active: true,
          startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // expired yesterday!
          sourceType: 'SUBSCRIPTION',
        },
      ],
      hasPremium: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: expiredResult }),
    });

    await billingManager.refreshEntitlements();

    expect(billingManager.hasEntitlement('PREMIUM')).toBe(false);
    expect(billingManager.isPremium()).toBe(false);
  });

  it('restores purchases across devices and sets authoritative state', async () => {
    const restoreResult: RestorePurchasesResultDto = {
      restoredCount: 1,
      subscriptions: [],
      effectiveEntitlements: [
        {
          code: 'PREMIUM',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: restoreResult }),
    });

    const result = await billingManager.restorePurchases('mock-receipt-data');

    expect(result.restoredCount).toBe(1);
    expect(billingManager.hasEntitlement('PREMIUM')).toBe(true);
  });

  it('queries transaction history with pagination parameters', async () => {
    const mockTxList: PaymentTransactionListResponseDto = {
      transactions: [
        {
          id: 'tx-1',
          userId: 'user-1',
          productId: 'prod-1',
          productCode: 'PREMIUM_MONTHLY',
          subscriptionId: 'sub-1',
          provider: 'APPLE_APP_STORE',
          transactionType: 'INITIAL_PURCHASE',
          status: 'SUCCEEDED',
          amountMinor: 19900,
          currency: 'INR',
          providerCreatedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: 'next-page-cursor',
      hasMore: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockTxList }),
    });

    const res = await apiClient.listTransactions(10, 'cur-1');

    expect(res.transactions).toHaveLength(1);
    expect(res.hasMore).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/billing/transactions?limit=10&cursor=cur-1',
      expect.anything()
    );
  });

  it('supports granular feature entitlements (ADVANCED_DISCOVERY, UNLIMITED_REWINDS, PROFILE_BOOST)', async () => {
    const multiEntitlementResult: EntitlementsListResponseDto = {
      entitlements: [
        {
          code: 'PREMIUM',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
        {
          code: 'ADVANCED_DISCOVERY',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
        {
          code: 'UNLIMITED_REWINDS',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
        {
          code: 'PROFILE_BOOST',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'ONE_TIME',
        },
      ],
      hasPremium: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: multiEntitlementResult }),
    });

    await billingManager.refreshEntitlements();

    expect(billingManager.hasEntitlement('PREMIUM')).toBe(true);
    expect(billingManager.hasEntitlement('ADVANCED_DISCOVERY')).toBe(true);
    expect(billingManager.hasEntitlement('UNLIMITED_REWINDS')).toBe(true);
    expect(billingManager.hasEntitlement('PROFILE_BOOST')).toBe(true);
    // Ungranted entitlement returns false
    expect(billingManager.hasEntitlement('SEE_LIKES')).toBe(false);
  });

  it('clears in-memory cache and entitlements when clearCache() is invoked', async () => {
    const activeResult: EntitlementsListResponseDto = {
      entitlements: [
        {
          code: 'PREMIUM',
          active: true,
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          sourceType: 'SUBSCRIPTION',
        },
      ],
      hasPremium: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: activeResult }),
    });

    await billingManager.refreshEntitlements();
    expect(billingManager.isPremium()).toBe(true);

    billingManager.clearCache();
    expect(billingManager.isPremium()).toBe(false);
    expect(billingManager.hasEntitlement('PREMIUM')).toBe(false);
  });

  it('generates platform-native store management deep links', () => {
    const appleUrl = billingManager.getManagementUrl('APPLE_APP_STORE');
    expect(appleUrl).toBe('https://apps.apple.com/account/subscriptions');

    const googleUrl = billingManager.getManagementUrl('GOOGLE_PLAY');
    expect(googleUrl).toBe('https://play.google.com/store/account/subscriptions');

    const fallbackUrl = billingManager.getManagementUrl('MOCK');
    expect(fallbackUrl).toBe('https://play.google.com/store/account/subscriptions');
  });

  it('fails safely when purchase verification returns HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Invalid purchase receipt token' }),
    });

    await expect(
      billingManager.purchaseProduct('PREMIUM_MONTHLY', 'invalid-token')
    ).rejects.toThrow('Invalid purchase receipt token');
  });

  it('handles zero restored purchases gracefully', async () => {
    const zeroResult: RestorePurchasesResultDto = {
      restoredCount: 0,
      subscriptions: [],
      effectiveEntitlements: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: zeroResult }),
    });

    const result = await billingManager.restorePurchases('empty-receipt');
    expect(result.restoredCount).toBe(0);
    expect(result.effectiveEntitlements).toHaveLength(0);
  });

  it('defines structured TanStack Query keys under BILLING_QUERY_KEYS', () => {
    expect(BILLING_QUERY_KEYS.root).toEqual(['billing']);
    expect(BILLING_QUERY_KEYS.products).toEqual(['billing', 'products']);
    expect(BILLING_QUERY_KEYS.entitlements).toEqual(['billing', 'entitlements']);
    expect(BILLING_QUERY_KEYS.subscriptions).toEqual(['billing', 'subscriptions']);
    expect(BILLING_QUERY_KEYS.transactions).toEqual(['billing', 'transactions']);
    expect(BILLING_QUERY_KEYS.transactionHistory(10, 'cursor-abc')).toEqual([
      'billing',
      'transactions',
      { limit: 10, cursor: 'cursor-abc' },
    ]);
  });

  it('clearBillingCaches and invalidateBillingCaches operate on TanStack QueryClient', () => {
    const queryClient = new QueryClient();
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateBillingCaches(queryClient);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BILLING_QUERY_KEYS.root });

    clearBillingCaches(queryClient);
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: BILLING_QUERY_KEYS.root });
  });

  it('sanitizeAnalyticsProperties scrubs receipts, purchaseTokens, and signedPayloads', () => {
    const payloadWithPii = {
      productId: 'PREMIUM_MONTHLY',
      source: 'discovery_paywall',
      receipt: 'MIIbPAYLOAD...',
      receiptData: 'ENCRYPTED_STORE_RECEIPT',
      purchaseToken: 'google_token_xyz',
      signedPayload: 'apple_jws_signature',
      safeMetric: 199,
    };

    const sanitized = sanitizeAnalyticsProperties(payloadWithPii);

    expect(sanitized.productId).toBe('PREMIUM_MONTHLY');
    expect(sanitized.source).toBe('discovery_paywall');
    expect(sanitized.safeMetric).toBe(199);
    expect(sanitized.receipt).toBeUndefined();
    expect(sanitized.receiptData).toBeUndefined();
    expect(sanitized.purchaseToken).toBeUndefined();
    expect(sanitized.signedPayload).toBeUndefined();
  });

  it('exports all F9 production billing components and hooks', async () => {
    const billingModules = await import('../src/billing/index.js');

    expect(billingModules.SubscriptionScreen).toBeDefined();
    expect(billingModules.BillingHistoryScreen).toBeDefined();
    expect(billingModules.PremiumGate).toBeDefined();
    expect(billingModules.useEntitlements).toBeDefined();
    expect(billingModules.useProducts).toBeDefined();
    expect(billingModules.useSubscriptions).toBeDefined();
    expect(billingModules.usePurchaseMutation).toBeDefined();
    expect(billingModules.useRestorePurchasesMutation).toBeDefined();
    expect(billingModules.useFeatureGate).toBeDefined();
    expect(billingModules.useBillingResumeSync).toBeDefined();
    expect(billingModules.clearBillingCaches).toBeDefined();
    expect(billingModules.invalidateBillingCaches).toBeDefined();
  });
});
