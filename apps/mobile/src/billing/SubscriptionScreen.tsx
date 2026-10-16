import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { ProductResponseDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Heading } from '../design/primitives/Heading.js';
import { Icon } from '../design/primitives/Icon.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { Button } from '../design/components/button/Button.js';
import { Banner } from '../design/components/feedback/Banner.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import type { BillingApiClient } from './billing-api.js';
import { billingManager } from './billing-manager.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';
import {
  useEntitlements,
  useProducts,
  useSubscriptions,
  usePurchaseMutation,
  useRestorePurchasesMutation,
  useBillingResumeSync,
} from './useEntitlements.js';

export interface SubscriptionScreenProps {
  readonly client?: BillingApiClient;
  readonly onDismiss?: () => void;
  readonly defaultPlanCode?: string;
  readonly returnRoute?: string;
}

const BENEFIT_ITEMS = [
  {
    icon: 'heart' as const,
    title: 'Unlimited Likes & Swipes',
    description: 'Connect freely every day without daily swipe caps.',
  },
  {
    icon: 'sparkles' as const,
    title: 'See Who Liked You',
    description: 'View members who liked your profile and match with them instantly.',
  },
  {
    icon: 'compass' as const,
    title: 'Advanced Intent & Lifestyle Filters',
    description: 'Filter candidates by relationship intent, verified status, and lifestyle.',
  },
  {
    icon: 'refresh' as const,
    title: 'Unlimited Rewinds',
    description: 'Accidentally passed on someone? Instantly rewind back.',
  },
  {
    icon: 'star' as const,
    title: 'Monthly Profile Boost',
    description: 'Included with Annual: 1 free boost/month to get seen by 10x more members.',
  },
];

export function SubscriptionScreen({
  client,
  onDismiss,
  defaultPlanCode = 'PREMIUM_ANNUAL',
  returnRoute,
}: SubscriptionScreenProps): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  // Reconcile on resume
  useBillingResumeSync();

  const entitlementsQuery = useEntitlements(client);
  const productsQuery = useProducts(client);
  const subscriptionsQuery = useSubscriptions(client);
  const purchaseMutation = usePurchaseMutation(client);
  const restoreMutation = useRestorePurchasesMutation(client);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { products, subscriptionProducts, annualProduct, monthlyProduct } = productsQuery;
  const { activeSubscription, isAutoRenewCancelled, isGracePeriod } = subscriptionsQuery;
  const isPremiumActive = entitlementsQuery.hasPremium;

  // Track paywall impression
  useEffect(() => {
    trackOnboardingEvent('premium_paywall_viewed', {
      source: isPremiumActive ? 'management_hub' : 'direct',
    });
  }, [isPremiumActive]);

  // Default selection
  useEffect(() => {
    if (selectedProductId) return;
    if (defaultPlanCode === 'PREMIUM_MONTHLY' && monthlyProduct) {
      setSelectedProductId(monthlyProduct.id);
    } else if (annualProduct) {
      setSelectedProductId(annualProduct.id);
    } else if (subscriptionProducts[0]) {
      setSelectedProductId(subscriptionProducts[0].id);
    }
  }, [defaultPlanCode, annualProduct, monthlyProduct, subscriptionProducts, selectedProductId]);

  const selectedProduct = useMemo(() => {
    return (
      products.find((p) => p.id === selectedProductId) || annualProduct || subscriptionProducts[0]
    );
  }, [products, selectedProductId, annualProduct, subscriptionProducts]);

  const handleSelectProduct = (prod: ProductResponseDto) => {
    haptics.selection();
    setSelectedProductId(prod.id);
    setErrorMessage(null);
    trackOnboardingEvent('premium_product_selected', {
      productId: prod.id,
      productCode: prod.code,
    });
  };

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    setErrorMessage(null);

    try {
      const result = await purchaseMutation.mutateAsync({
        productId: selectedProduct.code,
      });

      if (result.verified) {
        haptics.notificationSuccess();
        Alert.alert(
          'Welcome to Nazar Premium',
          'Your subscription is active and all premium features are now unlocked.',
          [
            {
              text: 'Continue',
              onPress: () => {
                haptics.selection();
                if (returnRoute) {
                  router.replace(returnRoute as never);
                } else if (onDismiss) {
                  onDismiss();
                } else {
                  router.back();
                }
              },
            },
          ]
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Purchase could not be verified. Please try again.';
      setErrorMessage(message);
    }
  };

  const handleRestore = async () => {
    haptics.selection();
    setErrorMessage(null);
    try {
      const result = await restoreMutation.mutateAsync(undefined);
      if (result.restoredCount > 0) {
        haptics.notificationSuccess();
        Alert.alert(
          'Purchases Restored',
          `Successfully restored ${result.restoredCount} active subscription(s).`
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous active subscriptions were found for this store account.'
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not restore purchases from store.';
      setErrorMessage(message);
    }
  };

  const handleManageInStore = () => {
    trackOnboardingEvent('subscription_management_opened', {
      plan: activeSubscription?.productCode,
    });
    const url = billingManager.getManagementUrl();
    void Linking.openURL(url).catch(() => {
      Alert.alert(
        'Subscription Management',
        'Please manage your subscriptions directly in your Apple App Store or Google Play account settings.'
      );
    });
  };

  const handleBack = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      router.back();
    }
  };

  const isLoading = productsQuery.isLoading || entitlementsQuery.isLoading;

  if (isLoading && products.length === 0) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
        testID="subscription-loading"
      >
        <ActivityIndicator size="large" color={colors.accent || '#E11D48'} />
        <Text level="body" color="secondary" style={styles.loadingText}>
          Loading premium plans...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title="Nazar Premium"
        leftAction="back"
        onBack={handleBack}
        testID="subscription-header"
      />

      <ScrollView contentContainerStyle={[styles.content, { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' }]}>
        {/* Error Banner */}
        {errorMessage && (
          <Banner
            variant="payment_issue"
            message={errorMessage}
            isDismissible
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Active Membership Hub (if user is currently subscribed) */}
        {isPremiumActive && activeSubscription && (
          <SurfaceCard
            elevation="sm"
            style={[styles.activeCard, { borderColor: colors.accent || '#E11D48' }]}
            testID="active-subscription-card"
          >
            <View style={styles.activeHeader}>
              <View style={styles.activeBadge}>
                <Text level="caption" weight="bold" style={styles.activeBadgeText}>
                  {isGracePeriod
                    ? 'PAYMENT GRACE PERIOD'
                    : isAutoRenewCancelled
                      ? 'ACTIVE (CANCELLED)'
                      : 'ACTIVE SUBSCRIBER'}
                </Text>
              </View>
              <Heading level="h3" style={{ color: colors.textPrimary }}>
                {activeSubscription.productCode === 'PREMIUM_ANNUAL'
                  ? 'Nazar Premium Annual'
                  : 'Nazar Premium Monthly'}
              </Heading>
            </View>

            <View style={styles.activeDetails}>
              {isAutoRenewCancelled ? (
                <Text level="bodySmall" color="secondary">
                  Auto-renewal is turned off. Your premium benefits remain active until{' '}
                  <Text weight="bold">
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  .
                </Text>
              ) : isGracePeriod ? (
                <Text level="bodySmall" color="error">
                  There was an issue processing your renewal payment. Your benefits are temporarily
                  active during the grace period. Please update your payment method in store
                  settings.
                </Text>
              ) : (
                <Text level="bodySmall" color="secondary">
                  Renews on{' '}
                  <Text weight="bold">
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  .
                </Text>
              )}
            </View>

            <View style={styles.activeActions}>
              <Button
                label="Manage in Store"
                variant="secondary"
                size="sm"
                onPress={handleManageInStore}
                testID="manage-subscription-button"
              />
              <Button
                label="Billing History"
                variant="tertiary"
                size="sm"
                onPress={() => router.push('/billing/history' as never)}
                testID="view-history-button"
              />
            </View>
          </SurfaceCard>
        )}

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Heading level="h1" style={styles.heroTitle}>
            Connect with Intent
          </Heading>
          <Text level="body" color="secondary" style={styles.heroSubtitle}>
            Unlock full clarity, zero limits, and priority exposure with Nazar Premium.
          </Text>
        </View>

        {/* Benefits List */}
        <SurfaceCard elevation="sm" style={styles.benefitsCard}>
          <Text level="title" weight="bold" color="primary" style={styles.benefitsTitle}>
            Everything Included
          </Text>
          {BENEFIT_ITEMS.map((item, index) => (
            <View key={index} style={styles.benefitRow}>
              <View
                style={[styles.benefitIconBox, { backgroundColor: colors.accentSoft || '#FFF1F2' }]}
              >
                <Icon name={item.icon} size={18} color={colors.accent || '#E11D48'} />
              </View>
              <View style={styles.benefitText}>
                <Text level="body" weight="semibold" color="primary">
                  {item.title}
                </Text>
                <Text level="bodySmall" color="secondary">
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </SurfaceCard>

        {/* Plans Selector */}
        <View style={styles.plansSection}>
          <Text level="title" weight="bold" color="primary" style={styles.sectionHeader}>
            Choose Your Plan
          </Text>

          <View style={styles.plansGrid}>
            {subscriptionProducts.map((prod) => {
              const isSelected = selectedProduct?.id === prod.id;
              const isAnnual = prod.code === 'PREMIUM_ANNUAL';

              return (
                <TouchableOpacity
                  key={prod.id}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.accent || '#E11D48' : colors.border,
                    },
                    isSelected && styles.selectedPlanCard,
                  ]}
                  onPress={() => handleSelectProduct(prod)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${prod.name}, ${prod.formattedPrice || ''}`}
                  testID={`plan-card-${prod.code}`}
                >
                  {isAnnual && (
                    <View
                      style={[
                        styles.bestValueBadge,
                        { backgroundColor: colors.accent || '#E11D48' },
                      ]}
                    >
                      <Text level="caption" weight="bold" style={styles.bestValueText}>
                        BEST VALUE (SAVE 37%)
                      </Text>
                    </View>
                  )}

                  <View style={styles.planHeader}>
                    <Text level="title" weight="bold" color="primary">
                      {isAnnual ? 'Annual' : 'Monthly'}
                    </Text>
                    <Text level="heading3" weight="bold" color="primary">
                      {prod.formattedPrice}
                    </Text>
                  </View>

                  <Text level="bodySmall" color="secondary">
                    {isAnnual ? 'Billed once per year (₹125/mo)' : 'Billed every month'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Primary CTA */}
        <Button
          label={
            purchaseMutation.isPending
              ? 'Processing...'
              : isPremiumActive
                ? 'Change Plan'
                : 'Upgrade to Nazar Premium'
          }
          variant="primary"
          size="lg"
          icon="sparkles"
          onPress={handlePurchase}
          disabled={purchaseMutation.isPending || !selectedProduct}
          testID="purchase-button"
        />

        {/* Secondary Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoreMutation.isPending}
            testID="restore-purchases-button"
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
          >
            {restoreMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text level="bodySmall" weight="semibold" color="secondary">
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push('/billing/history' as never)}
            accessibilityRole="button"
            accessibilityLabel="View billing history"
          >
            <Text level="bodySmall" color="tertiary">
              View Billing History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Legal & Auto-Renewal Disclosure */}
        <Text level="caption" color="tertiary" style={styles.legalNotice}>
          Recurring billing, cancel anytime. Subscriptions automatically renew unless cancelled at
          least 24 hours prior to the end of the current period in your App Store or Google Play
          account settings. By tapping Subscribe, you agree to our Terms of Service and Privacy
          Policy.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  activeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  activeHeader: {
    gap: 4,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  activeBadgeText: {
    color: '#15803D',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  activeDetails: {
    gap: 4,
  },
  activeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    marginVertical: 8,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  benefitsCard: {
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  benefitsTitle: {
    marginBottom: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  plansSection: {
    gap: 12,
  },
  sectionHeader: {
    marginBottom: 4,
  },
  plansGrid: {
    gap: 12,
  },
  planCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 6,
    position: 'relative',
  },
  selectedPlanCard: {
    borderWidth: 2,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerActions: {
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  restoreBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  historyBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  legalNotice: {
    textAlign: 'center',
    lineHeight: 16,
    marginHorizontal: 12,
  },
});
