import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingApiClient } from '../src/billing/billing-api.js';
import { BillingManager } from '../src/billing/billing-manager.js';
import type {
  ProductListResponseDto,
  PurchaseVerificationResultDto,
  EntitlementsListResponseDto,
  RestorePurchasesResultDto,
  PaymentTransactionListResponseDto,
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
});
