import { useCallback, useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  EntitlementCode,
  ProductResponseDto,
  PurchaseVerificationResultDto,
  RestorePurchasesResultDto,
  SubscriptionResponseDto,
  UserEntitlementDto,
} from '@platform/api-contracts';
import {
  BILLING_QUERY_KEYS,
  getDefaultBillingApi,
  type BillingApiClient,
} from './billing-api.js';
import { billingManager } from './billing-manager.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

const ENTITLEMENTS_STALE_TIME = 60_000; // 1 minute
const PRODUCTS_STALE_TIME = 300_000; // 5 minutes
const SUBSCRIPTIONS_STALE_TIME = 60_000; // 1 minute

export interface EntitlementsState {
  readonly entitlements: readonly UserEntitlementDto[];
  readonly hasPremium: boolean;
  readonly hasEntitlement: (code: EntitlementCode) => boolean;
  readonly activeCodes: ReadonlySet<EntitlementCode>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Authoritative entitlement query.
 *
 * Sourced directly from `GET /v1/billing/entitlements`. Never derives entitlement
 * from local store caches or optimistic client assumptions.
 */
export function useEntitlements(apiClient?: BillingApiClient): EntitlementsState {
  const client = apiClient ?? getDefaultBillingApi();

  const query = useQuery({
    queryKey: BILLING_QUERY_KEYS.entitlements,
    staleTime: ENTITLEMENTS_STALE_TIME,
    queryFn: async () => {
      billingManager.initialize(client);
      return client.getEntitlements();
    },
  });

  const entitlements = query.data?.entitlements ?? [];

  const activeCodes = useMemo(() => {
    const now = new Date();
    const set = new Set<EntitlementCode>();
    for (const e of entitlements) {
      if (e.active && (!e.expiresAt || new Date(e.expiresAt) > now)) {
        set.add(e.code);
      }
    }
    return set;
  }, [entitlements]);

  const hasEntitlement = useCallback(
    (code: EntitlementCode): boolean => {
      return activeCodes.has(code);
    },
    [activeCodes]
  );

  const hasPremium = useMemo(() => {
    return query.data?.hasPremium === true || hasEntitlement('PREMIUM');
  }, [query.data?.hasPremium, hasEntitlement]);

  return {
    entitlements,
    hasPremium,
    hasEntitlement,
    activeCodes,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
}

export interface ProductsState {
  readonly products: readonly ProductResponseDto[];
  readonly subscriptionProducts: readonly ProductResponseDto[];
  readonly oneTimeProducts: readonly ProductResponseDto[];
  readonly annualProduct: ProductResponseDto | undefined;
  readonly monthlyProduct: ProductResponseDto | undefined;
  readonly boostProduct: ProductResponseDto | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Available products catalog loaded from `GET /v1/billing/products`.
 */
export function useProducts(apiClient?: BillingApiClient): ProductsState {
  const client = apiClient ?? getDefaultBillingApi();

  const query = useQuery({
    queryKey: BILLING_QUERY_KEYS.products,
    staleTime: PRODUCTS_STALE_TIME,
    queryFn: async () => client.listProducts(),
  });

  const products = query.data?.products ?? [];

  const subscriptionProducts = useMemo(
    () => products.filter((p) => p.productType === 'SUBSCRIPTION'),
    [products]
  );

  const oneTimeProducts = useMemo(
    () => products.filter((p) => p.productType !== 'SUBSCRIPTION'),
    [products]
  );

  const annualProduct = useMemo(
    () => products.find((p) => p.code === 'PREMIUM_ANNUAL'),
    [products]
  );

  const monthlyProduct = useMemo(
    () => products.find((p) => p.code === 'PREMIUM_MONTHLY'),
    [products]
  );

  const boostProduct = useMemo(
    () => products.find((p) => p.code === 'BOOST_ONE_TIME'),
    [products]
  );

  return {
    products,
    subscriptionProducts,
    oneTimeProducts,
    annualProduct,
    monthlyProduct,
    boostProduct,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
}

export interface SubscriptionsState {
  readonly subscriptions: readonly SubscriptionResponseDto[];
  readonly activeSubscription: SubscriptionResponseDto | undefined;
  readonly isAutoRenewCancelled: boolean;
  readonly isGracePeriod: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Authoritative user subscriptions query loaded from `GET /v1/billing/subscriptions`.
 */
export function useSubscriptions(apiClient?: BillingApiClient): SubscriptionsState {
  const client = apiClient ?? getDefaultBillingApi();

  const query = useQuery({
    queryKey: BILLING_QUERY_KEYS.subscriptions,
    staleTime: SUBSCRIPTIONS_STALE_TIME,
    queryFn: async () => client.listSubscriptions(),
  });

  const subscriptions = query.data?.subscriptions ?? [];

  const activeSubscription = useMemo(() => {
    return subscriptions.find(
      (s) => s.status === 'ACTIVE' || s.status === 'GRACE_PERIOD'
    );
  }, [subscriptions]);

  const isAutoRenewCancelled = useMemo(() => {
    return activeSubscription !== undefined && !activeSubscription.autoRenewEnabled;
  }, [activeSubscription]);

  const isGracePeriod = useMemo(() => {
    return activeSubscription?.status === 'GRACE_PERIOD';
  }, [activeSubscription]);

  return {
    subscriptions,
    activeSubscription,
    isAutoRenewCancelled,
    isGracePeriod,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
}

/**
 * Purchase verification mutation.
 *
 * Verifies transaction with backend and updates cache atomically.
 */
export function usePurchaseMutation(apiClient?: BillingApiClient) {
  const client = apiClient ?? getDefaultBillingApi();
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseVerificationResultDto,
    Error,
    { productId: string; transactionId?: string }
  >({
    mutationFn: async ({ productId, transactionId }) => {
      billingManager.initialize(client);
      trackOnboardingEvent('purchase_started', { productId });
      try {
        const result = await billingManager.purchaseProduct(productId, transactionId);
        return result;
      } catch (err: unknown) {
        trackOnboardingEvent('purchase_failed', {
          productId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      trackOnboardingEvent('purchase_validated', {
        productId: variables.productId,
        verified: result.verified,
      });
      if (result.verified) {
        trackOnboardingEvent('entitlement_activated', {
          productId: variables.productId,
        });
      }
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.entitlements });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.subscriptions });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.transactions });
    },
  });
}

/**
 * Restore purchases mutation.
 */
export function useRestorePurchasesMutation(apiClient?: BillingApiClient) {
  const client = apiClient ?? getDefaultBillingApi();
  const queryClient = useQueryClient();

  return useMutation<RestorePurchasesResultDto, Error, string | undefined>({
    mutationFn: async (receiptOrToken) => {
      billingManager.initialize(client);
      const result = await billingManager.restorePurchases(receiptOrToken);
      return result;
    },
    onSuccess: (result) => {
      trackOnboardingEvent('purchase_restored', {
        restoredCount: result.restoredCount,
      });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.entitlements });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.subscriptions });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.transactions });
    },
  });
}

/**
 * Reusable feature gate hook.
 *
 * Checks authoritative entitlement state for a specific entitlement code.
 */
export function useFeatureGate(
  feature: EntitlementCode,
  apiClient?: BillingApiClient
): { isUnlocked: boolean; isLoading: boolean; feature: EntitlementCode } {
  const { hasEntitlement, hasPremium, isLoading } = useEntitlements(apiClient);

  const isUnlocked = useMemo(() => {
    if (feature === 'PREMIUM') {
      return hasPremium;
    }
    return hasPremium || hasEntitlement(feature);
  }, [feature, hasPremium, hasEntitlement]);

  return { isUnlocked, isLoading, feature };
}

/**
 * Background-to-foreground app resume sync.
 *
 * Revalidates entitlements and subscription status on app return,
 * ensuring external cancellations or renewals in App Store / Google Play
 * are reconciled immediately.
 */
export function useBillingResumeSync(queryClient?: QueryClient): void {
  const qc = useQueryClient();
  const activeQc = queryClient ?? qc;

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void activeQc.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.entitlements });
        void activeQc.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.subscriptions });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [activeQc]);
}

/**
 * Invalidates all billing query caches.
 */
export function invalidateBillingCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEYS.root });
}

/**
 * Clears all billing query caches (e.g. on logout or account switch).
 */
export function clearBillingCaches(queryClient: QueryClient): void {
  billingManager.clearCache();
  queryClient.removeQueries({ queryKey: BILLING_QUERY_KEYS.root });
}
