import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { ProductResponseDto, UserEntitlementDto } from '@platform/api-contracts';
import type { BillingApiClient } from './billing-api.js';
import { billingManager } from './billing-manager.js';

export interface SubscriptionScreenProps {
  readonly client: BillingApiClient;
}

export function SubscriptionScreen({ client }: SubscriptionScreenProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductResponseDto[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductResponseDto | null>(null);
  const [entitlements, setEntitlements] = useState<UserEntitlementDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      billingManager.initialize(client);

      const [productsRes, ents] = await Promise.all([
        client.listProducts(),
        billingManager.refreshEntitlements(),
      ]);

      setProducts([...productsRes.products]);
      setEntitlements(ents);

      // Default select the annual plan if available, or first product
      const annual = productsRes.products.find((p) => p.code === 'PREMIUM_ANNUAL');
      setSelectedProduct(annual || productsRes.products[0] || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    try {
      setIsPurchasing(true);
      setError(null);

      const result = await billingManager.purchaseProduct(selectedProduct.code);
      setEntitlements([...result.effectiveEntitlements]);

      Alert.alert(
        'Welcome to Premium! 🎉',
        'Your subscription is active. All premium features are now unlocked.',
        [{ text: 'Continue', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase verification failed';
      setError(msg);
      Alert.alert('Purchase Failed', msg);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      setError(null);

      const result = await billingManager.restorePurchases();
      setEntitlements([...result.effectiveEntitlements]);

      if (result.restoredCount > 0) {
        Alert.alert(
          'Purchases Restored',
          `Successfully restored ${result.restoredCount} active subscription(s).`
        );
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases found for this store account.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore purchases';
      setError(msg);
      Alert.alert('Restore Failed', msg);
    } finally {
      setIsRestoring(false);
    }
  };

  const isPremiumActive = entitlements.some((e) => e.code === 'PREMIUM' && e.active);

  if (isLoading) {
    return (
      <View style={styles.centerContainer} testID="subscription-loading">
        <ActivityIndicator size="large" color="#E11D48" />
        <Text style={styles.loadingText}>Loading membership plans...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Unlock Nazar Premium</Text>
        <Text style={styles.subtitle}>
          Connect faster with high-intent matches and zero daily limits.
        </Text>
        {isPremiumActive && (
          <View style={styles.activeBadge} testID="active-premium-badge">
            <Text style={styles.activeBadgeText}>ACTIVE MEMBERSHIP</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer} testID="subscription-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Feature Entitlements List */}
      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>What is included:</Text>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>✨</Text>
          <Text style={styles.featureText}>Unlimited Likes & Discovery Swipes</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>👀</Text>
          <Text style={styles.featureText}>See Who Liked You First</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🎯</Text>
          <Text style={styles.featureText}>Advanced Discovery & Intent Filters</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>⏪</Text>
          <Text style={styles.featureText}>Unlimited Rewinds on Accidental Passes</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🚀</Text>
          <Text style={styles.featureText}>Monthly Profile Boost to Top Candidates</Text>
        </View>
      </View>

      {/* Subscription Plans */}
      <View style={styles.plansContainer}>
        {products
          .filter((p) => p.productType === 'SUBSCRIPTION')
          .map((prod) => {
            const isSelected = selectedProduct?.id === prod.id;
            const isBestValue = prod.code === 'PREMIUM_ANNUAL';

            return (
              <TouchableOpacity
                key={prod.id}
                style={[styles.planCard, isSelected && styles.selectedPlanCard]}
                onPress={() => setSelectedProduct(prod)}
                testID={`plan-card-${prod.code}`}
                accessibilityRole="button"
                accessibilityLabel={`${prod.name} ${prod.formattedPrice}`}
              >
                {isBestValue && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>BEST VALUE (SAVE 37%)</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, isSelected && styles.selectedPlanText]}>
                    {prod.name}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.selectedPlanPrice]}>
                    {prod.formattedPrice}
                  </Text>
                </View>
                <Text style={styles.planDuration}>
                  {prod.durationDays === 365 ? '12 months billed upfront' : 'Billed monthly'}
                </Text>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.purchaseButton, (isPurchasing || !selectedProduct) && styles.disabledButton]}
        onPress={handlePurchase}
        disabled={isPurchasing || !selectedProduct}
        testID="purchase-button"
        accessibilityRole="button"
      >
        {isPurchasing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.purchaseButtonText}>
            {isPremiumActive ? 'Change Membership Plan' : 'Subscribe Now'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={isRestoring}
        testID="restore-purchases-button"
      >
        {isRestoring ? (
          <ActivityIndicator size="small" color="#64748B" />
        ) : (
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.historyLink}
        onPress={() => router.push('/billing/history' as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
      >
        <Text style={styles.historyLinkText}>View Billing History</Text>
      </TouchableOpacity>

      {/* Terms Notice */}
      <Text style={styles.termsText}>
        Subscriptions automatically renew unless canceled at least 24 hours before the end of the current
        period in App Store / Google Play account settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  activeBadge: {
    marginTop: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  errorContainer: {
    backgroundColor: '#451A1A',
    borderColor: '#E11D48',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  featuresCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featuresTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  plansContainer: {
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  selectedPlanCard: {
    borderColor: '#E11D48',
    backgroundColor: '#231B2D',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#E11D48',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  selectedPlanText: {
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  selectedPlanPrice: {
    color: '#E11D48',
  },
  planDuration: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  purchaseButton: {
    backgroundColor: '#E11D48',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  restoreButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  historyLink: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  historyLinkText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
