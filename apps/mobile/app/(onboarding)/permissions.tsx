import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function OnboardingPermissionsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();

  // Animated scroll listener for glossy top vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

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

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/preferences');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Glossy, Faded, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glossyTopOverlay,
          {
            height: Math.max(insets.top + 54, 70),
            opacity: headerGlossOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 0.92)',
                  'rgba(11, 11, 14, 0.70)',
                  'rgba(11, 11, 14, 0.28)',
                  'rgba(11, 11, 14, 0.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 0.92)',
                  'rgba(250, 250, 250, 0.70)',
                  'rgba(250, 250, 250, 0.28)',
                  'rgba(250, 250, 250, 0.0)',
                ]
          }
          locations={[0, 0.4, 0.68, 0.88, 1.0]}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular Gloss Sheen Layer */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255, 255, 255, 0.08)',
                  'rgba(255, 255, 255, 0.03)',
                  'rgba(255, 255, 255, 0.0)',
                ]
              : [
                  'rgba(255, 255, 255, 0.70)',
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.0)',
                ]
          }
          locations={[0, 0.45, 1.0]}
          style={styles.glossySheenLayer}
        />
      </Animated.View>

      {/* Encircled floating circular back button on top left corner */}
      <TouchableOpacity
        onPress={handleBack}
        style={[
          styles.encircledBackButton,
          {
            top: Math.max(insets.top + 8, 16),
            left: Math.max(insets.left + 16, 16),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="onboarding-back-button"
      >
        <ArrowLeft size={20} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 64, 76),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              Trust & Permissions
            </Heading>
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                07
              </Text>
              <Text
                style={[
                  styles.stepDividerText,
                  { color: theme.colors.textTertiary, fontFamily: folkraFont },
                ]}
              >
                /
              </Text>
              <Text
                style={[
                  styles.stepTotalText,
                  { color: theme.colors.textTertiary, fontFamily: folkraFont },
                ]}
              >
                07
              </Text>
            </View>
          </View>
          <Text level="body" color="secondary" style={styles.subtitle}>
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
                <Text
                  level="title"
                  style={{ color: theme.colors.textPrimary, fontFamily: folkraFont }}
                >
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
                <Text
                  level="title"
                  style={{ color: theme.colors.textPrimary, fontFamily: folkraFont }}
                >
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
              <Text
                level="title"
                style={{
                  color: theme.colors.textPrimary,
                  fontWeight: '700',
                  fontFamily: folkraFont,
                }}
              >
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
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  encircledBackButton: {
    position: 'absolute',
    zIndex: 25,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glossyTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  glossySheenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stepCurrentText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stepDividerText: {
    fontSize: 13.5,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  stepTotalText: {
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
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
