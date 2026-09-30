import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { EntitlementCode } from '@platform/api-contracts';
import { useFeatureGate } from './useEntitlements.js';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { Button } from '../design/components/button/Button.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface PremiumGateProps {
  readonly feature: EntitlementCode;
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
  readonly showLockedBanner?: boolean;
  readonly lockedTitle?: string;
  readonly lockedMessage?: string;
  readonly onUnlockPress?: () => void;
  readonly testID?: string;
}

const FEATURE_DESCRIPTIONS: Record<
  EntitlementCode,
  { title: string; message: string }
> = {
  PREMIUM: {
    title: 'Nazar Premium',
    message: 'Upgrade to Nazar Premium to unlock this experience.',
  },
  SEE_LIKES: {
    title: 'See Who Liked You',
    message: 'Reveal members who liked your profile and match with them instantly.',
  },
  UNLIMITED_LIKES: {
    title: 'Unlimited Likes',
    message: 'Send unlimited likes each day with no daily limits.',
  },
  ADVANCED_DISCOVERY: {
    title: 'Advanced Discovery Filters',
    message: 'Filter by relationship intent, verified status, lifestyle, and distance.',
  },
  PROFILE_BOOST: {
    title: 'Profile Boost',
    message: 'Boost your profile to be seen by 10x more high-intent members.',
  },
  UNLIMITED_REWINDS: {
    title: 'Unlimited Rewinds',
    message: 'Accidentally passed on someone? Rewind and take another look.',
  },
};

/**
 * Reusable feature gate component.
 *
 * Verifies server-authoritative entitlements before unlocking UI.
 * Renders fallback or a locked feature card when unentitled.
 */
export function PremiumGate({
  feature,
  children,
  fallback,
  showLockedBanner = true,
  lockedTitle,
  lockedMessage,
  onUnlockPress,
  testID = 'premium-gate',
}: PremiumGateProps): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const { isUnlocked, isLoading } = useFeatureGate(feature);

  const defaultMeta = FEATURE_DESCRIPTIONS[feature] || {
    title: 'Premium Feature',
    message: 'This feature is available exclusively with Nazar Premium.',
  };

  const title = lockedTitle || defaultMeta.title;
  const message = lockedMessage || defaultMeta.message;

  useEffect(() => {
    if (!isLoading && !isUnlocked) {
      trackOnboardingEvent('premium_feature_locked', { feature });
    }
  }, [isLoading, isUnlocked, feature]);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showLockedBanner) {
    return <View testID={`${testID}-locked-empty`} />;
  }

  const handleUnlock = () => {
    trackOnboardingEvent('premium_paywall_viewed', { source: `gate_${feature}` });
    if (onUnlockPress) {
      onUnlockPress();
    } else {
      router.push('/billing' as never);
    }
  };

  return (
    <SurfaceCard
      elevation="sm"
      style={[
        styles.lockedCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID={`${testID}-locked-banner`}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.accentSoft || '#FFF1F2' },
          ]}
        >
          <Icon name="lock" size={20} color={colors.accent || '#E11D48'} />
        </View>
        <View style={styles.textContainer}>
          <Text level="title" weight="bold" color="primary">
            {title}
          </Text>
          <Text level="bodySmall" color="secondary" style={styles.message}>
            {message}
          </Text>
        </View>
      </View>

      <Button
        label="Unlock with Premium"
        variant="primary"
        size="sm"
        onPress={handleUnlock}
        testID={`${testID}-unlock-button`}
        accessibilityLabel={`Unlock ${title}`}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  lockedCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  message: {
    lineHeight: 18,
  },
});
