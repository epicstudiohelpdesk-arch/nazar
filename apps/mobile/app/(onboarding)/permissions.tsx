import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function OnboardingPermissionsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  const { permissionsStatus, setPermissionStatus } = useOnboardingStore();

  const [locationGranted, setLocationGranted] = useState(permissionsStatus.location === 'granted');
  const [notificationsGranted, setNotificationsGranted] = useState(
    permissionsStatus.push === 'granted'
  );

  useEffect(() => {
    trackOnboardingEvent('permissions_prompted');
  }, []);

  const handleToggleLocation = () => {
    const next = !locationGranted;
    if (next) {
      haptics.notificationSuccess();
    } else {
      haptics.selection();
    }
    setLocationGranted(next);
    setPermissionStatus('location', next ? 'granted' : 'denied');
    if (next) {
      trackOnboardingEvent('permission_granted', { type: 'location' });
    } else {
      trackOnboardingEvent('permission_denied', { type: 'location' });
    }
  };

  const handleToggleNotifications = () => {
    const next = !notificationsGranted;
    if (next) {
      haptics.notificationSuccess();
    } else {
      haptics.selection();
    }
    setNotificationsGranted(next);
    setPermissionStatus('push', next ? 'granted' : 'denied');
    if (next) {
      trackOnboardingEvent('permission_granted', { type: 'push' });
    } else {
      trackOnboardingEvent('permission_denied', { type: 'push' });
    }
  };

  const handleOpenSettings = () => {
    haptics.impactLight();
    Linking.openSettings().catch(() => {});
  };

  const handleContinue = () => {
    haptics.impactMedium();
    router.push('/(onboarding)/preview');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />
      <ProgressBar progress={0.9} style={styles.progressBar} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text level="label" color="accent">
            STEP 6 OF 6
          </Text>
          <Heading level="h1">Trust & Permissions</Heading>
          <Text level="body" color="secondary">
            Nazar needs a couple of key permissions to curate relevant matches and notify you when
            you connect.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Location Permission */}
          <SurfaceCard
            elevation="none"
            style={[
              styles.permissionCard,
              {
                borderColor: locationGranted ? theme.colors.accent : theme.colors.border,
                backgroundColor: locationGranted ? theme.colors.accentSoft : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: locationGranted
                      ? theme.colors.accent
                      : theme.colors.surfaceMuted,
                  },
                ]}
              >
                <Icon
                  name="location"
                  size={24}
                  color={locationGranted ? '#FFFFFF' : theme.colors.accent}
                />
              </View>
              <View style={styles.cardTitleBox}>
                <Text level="title" style={{ color: theme.colors.textPrimary }}>
                  Location Services
                </Text>
                <Text
                  level="caption"
                  style={{
                    color: locationGranted ? theme.colors.accentStrong : theme.colors.textSecondary,
                  }}
                >
                  {locationGranted ? '✓ Enabled' : 'Recommended'}
                </Text>
              </View>
            </View>

            <Text level="bodySmall" color="secondary" style={styles.benefitText}>
              Find people in your city or neighborhood. Your exact coordinates are never shared with
              anyone.
            </Text>

            <View style={styles.actionRow}>
              <Button
                variant={locationGranted ? 'secondary' : 'primary'}
                size="md"
                onPress={handleToggleLocation}
                accessibilityLabel={
                  locationGranted ? 'Revoke location access' : 'Allow location access'
                }
              >
                {locationGranted ? 'Access Allowed' : 'Allow Location'}
              </Button>
            </View>
          </SurfaceCard>

          {/* Push Notifications Permission */}
          <SurfaceCard
            elevation="none"
            style={[
              styles.permissionCard,
              {
                borderColor: notificationsGranted ? theme.colors.accent : theme.colors.border,
                backgroundColor: notificationsGranted
                  ? theme.colors.accentSoft
                  : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: notificationsGranted
                      ? theme.colors.accent
                      : theme.colors.surfaceMuted,
                  },
                ]}
              >
                <Icon
                  name="bell"
                  size={24}
                  color={notificationsGranted ? '#FFFFFF' : theme.colors.accent}
                />
              </View>
              <View style={styles.cardTitleBox}>
                <Text level="title" style={{ color: theme.colors.textPrimary }}>
                  Push Notifications
                </Text>
                <Text
                  level="caption"
                  style={{
                    color: notificationsGranted
                      ? theme.colors.accentStrong
                      : theme.colors.textSecondary,
                  }}
                >
                  {notificationsGranted ? '✓ Enabled' : 'Recommended'}
                </Text>
              </View>
            </View>

            <Text level="bodySmall" color="secondary" style={styles.benefitText}>
              Get notified immediately when someone likes your profile, a mutual match happens, or a
              message arrives.
            </Text>

            <View style={styles.actionRow}>
              <Button
                variant={notificationsGranted ? 'secondary' : 'primary'}
                size="md"
                onPress={handleToggleNotifications}
                accessibilityLabel={
                  notificationsGranted ? 'Revoke notifications' : 'Allow notifications'
                }
              >
                {notificationsGranted ? 'Notifications Allowed' : 'Allow Notifications'}
              </Button>
            </View>
          </SurfaceCard>

          {/* Privacy Note */}
          <SurfaceCard
            elevation="none"
            style={[
              styles.privacyCard,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="lock" size={16} color={theme.colors.accent} />
              <Text level="title" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
                Privacy Promise
              </Text>
            </View>
            <Text level="caption" color="secondary">
              You can adjust these permissions anytime in your device settings.
            </Text>
          </SurfaceCard>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleContinue}
            accessibilityLabel="Continue to Profile Preview"
          >
            Continue to Preview
          </Button>

          <Button
            variant="tertiary"
            size="md"
            fullWidth
            onPress={handleOpenSettings}
            accessibilityLabel="Open device settings"
            style={{ marginTop: 8 }}
          >
            Device Settings
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  cardsContainer: {
    marginVertical: 24,
    gap: 16,
  },
  permissionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  benefitText: {
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  privacyCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 12,
  },
});
