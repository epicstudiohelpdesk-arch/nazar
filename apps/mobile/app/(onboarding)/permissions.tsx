import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Bell,
  ShieldCheck,
  Lock,
  SlidersHorizontal,
  ExternalLink,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

interface LuxurySwitchProps {
  readonly value: boolean;
  readonly isDark: boolean;
}

/**
 * 100% Native-Driver Switch with Snappy Zero-Latency Spring
 * Operates purely on the native UI thread (60/120fps) with zero JS bridge lag.
 */
function LuxurySwitch({ value, isDark }: LuxurySwitchProps): React.JSX.Element {
  const switchAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(switchAnim, {
      toValue: value ? 1 : 0,
      tension: 300,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [value, switchAnim]);

  const thumbTranslateX = switchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.switchTrack,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.10)',
        },
      ]}
    >
      {/* Active Track Overlay (Fades in natively via opacity) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.switchTrackActive,
          {
            backgroundColor: isDark ? '#FFFFFF' : '#121216',
            opacity: switchAnim,
          },
        ]}
      />

      {/* Thumb with Native TranslateX */}
      <Animated.View
        style={[
          styles.switchThumb,
          {
            transform: [{ translateX: thumbTranslateX }],
            backgroundColor: '#A1A1AA',
          },
        ]}
      >
        {/* Active Thumb Color Overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.switchThumbActive,
            {
              backgroundColor: isDark ? '#0B0B0E' : '#FFFFFF',
              opacity: switchAnim,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

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

  // Instantaneous, zero-latency toggle handlers with haptic-first execution
  const handleToggleLocation = () => {
    haptics.selection();
    const next = !locationGranted;
    setLocationGranted(next);
    setPermissionStatus('location', next ? 'granted' : 'denied');
    // Defer analytics off the critical touch frame
    setTimeout(() => {
      trackOnboardingEvent(next ? 'permission_granted' : 'permission_denied', { type: 'location' });
    }, 0);
  };

  const handleToggleNotifications = () => {
    haptics.selection();
    const next = !notificationsGranted;
    setNotificationsGranted(next);
    setPermissionStatus('push', next ? 'granted' : 'denied');
    // Defer analytics off the critical touch frame
    setTimeout(() => {
      trackOnboardingEvent(next ? 'permission_granted' : 'permission_denied', { type: 'push' });
    }, 0);
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
      {/* Glossy, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
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
        delayPressIn={0}
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
        {/* Header Title Section: Properly Padded & Non-Clipping 07/07 */}
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
            Nazar operates on explicit consent and cryptographic privacy. Configure how your device
            interacts with your discovery matches.
          </Text>
        </View>

        {/* Fluid, Non-Boxy Sections Stack */}
        <View style={styles.fluidSectionsContainer}>
          {/* ========================================================================= */}
          {/* Section 1: Location Precision (Compact, Identical Height, Zero Clipping)  */}
          {/* ========================================================================= */}
          <TouchableOpacity
            activeOpacity={0.78}
            delayPressIn={0}
            onPress={handleToggleLocation}
            style={[
              styles.fluidSurface,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: locationGranted }}
            accessibilityLabel="Location precision. Tap to toggle."
          >
            {/* Ambient Accent Indicator Strip (Left Glow Accent) */}
            <View
              style={[
                styles.surfaceAccentGlow,
                {
                  backgroundColor: locationGranted
                    ? isDark
                      ? '#FFFFFF'
                      : '#121216'
                    : 'transparent',
                },
              ]}
            />

            {/* Header: Organic Icon + Title + Status + Native Switch */}
            <View style={styles.fluidHeaderRow}>
              <View style={styles.fluidHeaderLeft}>
                <View
                  style={[
                    styles.organicIconBadge,
                    {
                      backgroundColor: locationGranted
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.08)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <MapPin size={16} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.titleColumn}>
                  <Text
                    style={[
                      styles.fluidTitle,
                      {
                        color: theme.colors.textPrimary,
                        fontFamily: folkraFont,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Location Precision
                  </Text>
                  <View style={styles.statusSubline}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: locationGranted ? '#10B981' : '#71717A' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: locationGranted
                            ? theme.colors.textPrimary
                            : theme.colors.textTertiary,
                        },
                      ]}
                    >
                      {locationGranted ? 'Active • Neighborhood Radar' : 'Optional • Proximity Paused'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Instant Native-Driven Switch */}
              <LuxurySwitch value={locationGranted} isDark={isDark} />
            </View>

            {/* Concise Narrative (No Text Clipping) */}
            <Text
              style={[
                styles.fluidDescription,
                { color: theme.colors.textSecondary },
              ]}
            >
              Encrypted neighborhood radar. Coarse coordinates are hashed on-device and never visible to others.
            </Text>
          </TouchableOpacity>

          {/* ========================================================================= */}
          {/* Section 2: Real-Time Alerts (Compact, Identical Height, Zero Clipping)    */}
          {/* ========================================================================= */}
          <TouchableOpacity
            activeOpacity={0.78}
            delayPressIn={0}
            onPress={handleToggleNotifications}
            style={[
              styles.fluidSurface,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: notificationsGranted }}
            accessibilityLabel="Real-time alerts. Tap to toggle."
          >
            {/* Ambient Accent Indicator Strip */}
            <View
              style={[
                styles.surfaceAccentGlow,
                {
                  backgroundColor: notificationsGranted
                    ? isDark
                      ? '#FFFFFF'
                      : '#121216'
                    : 'transparent',
                },
              ]}
            />

            {/* Header: Organic Icon + Title + Status + Native Switch */}
            <View style={styles.fluidHeaderRow}>
              <View style={styles.fluidHeaderLeft}>
                <View
                  style={[
                    styles.organicIconBadge,
                    {
                      backgroundColor: notificationsGranted
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.08)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <Bell size={16} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.titleColumn}>
                  <Text
                    style={[
                      styles.fluidTitle,
                      {
                        color: theme.colors.textPrimary,
                        fontFamily: folkraFont,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Real-Time Alerts
                  </Text>
                  <View style={styles.statusSubline}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: notificationsGranted ? '#10B981' : '#71717A' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: notificationsGranted
                            ? theme.colors.textPrimary
                            : theme.colors.textTertiary,
                        },
                      ]}
                    >
                      {notificationsGranted ? 'Active • Instant Dispatch' : 'Muted • In-App Feed Only'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Instant Native-Driven Switch */}
              <LuxurySwitch value={notificationsGranted} isDark={isDark} />
            </View>

            {/* Concise Narrative matching Section 1 exactly */}
            <Text
              style={[
                styles.fluidDescription,
                { color: theme.colors.textSecondary },
              ]}
            >
              Instant alerts for mutual matches, chat replies, and safety check-ins with zero marketing spam.
            </Text>
          </TouchableOpacity>

          {/* ======================================================== */}
          {/* Section 3: Privacy Architecture (Completely Non-Boxy)    */}
          {/* ======================================================== */}
          <View style={styles.editorialTrustCanvas}>
            {/* Top Atmospheric Gradient Divider */}
            <View style={styles.atmosphericDividerContainer}>
              <LinearGradient
                colors={
                  isDark
                    ? [
                        'rgba(255, 255, 255, 0.0)',
                        'rgba(255, 255, 255, 0.12)',
                        'rgba(255, 255, 255, 0.0)',
                      ]
                    : [
                        'rgba(0, 0, 0, 0.0)',
                        'rgba(0, 0, 0, 0.08)',
                        'rgba(0, 0, 0, 0.0)',
                      ]
                }
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.atmosphericDividerLine}
              />
            </View>

            {/* Non-Boxy Trust Seal Header */}
            <View style={styles.trustSealHeader}>
              <View
                style={[
                  styles.shieldEmblem,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}
              >
                <ShieldCheck size={16} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </View>
              <Text
                style={[
                  styles.trustSealTitle,
                  {
                    color: theme.colors.textPrimary,
                    fontFamily: folkraFont,
                  },
                ]}
              >
                Privacy Architecture
              </Text>
              <View
                style={[
                  styles.minimalPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.minimalPillText,
                    { color: isDark ? '#D4D4D8' : '#52525B' },
                  ]}
                >
                  ZERO-PII
                </Text>
              </View>
            </View>

            {/* Flowing Trust Principles (Open, Borderless Typography) */}
            <View style={styles.trustPrinciplesStack}>
              <View style={styles.principleRow}>
                <View style={styles.principleBullet}>
                  <Lock size={13} color={theme.colors.textSecondary} strokeWidth={2} />
                </View>
                <View style={styles.principleContent}>
                  <Text style={[styles.principleHeading, { color: theme.colors.textPrimary }]}>
                    Local Device Revocation
                  </Text>
                  <Text style={[styles.principleBody, { color: theme.colors.textSecondary }]}>
                    Permissions stay strictly confined to this handset. You can modify or permanently
                    revoke them anytime via system settings without impacting account standing.
                  </Text>
                </View>
              </View>

              <View style={styles.principleRow}>
                <View style={styles.principleBullet}>
                  <Check size={13} color={theme.colors.textSecondary} strokeWidth={2.4} />
                </View>
                <View style={styles.principleContent}>
                  <Text style={[styles.principleHeading, { color: theme.colors.textPrimary }]}>
                    Ephemeral Coordinate Hashing
                  </Text>
                  <Text style={[styles.principleBody, { color: theme.colors.textSecondary }]}>
                    Raw GPS coordinates are never written to database tables. Distance metrics are
                    bucketed on-device into coarse kilometer radius tiers.
                  </Text>
                </View>
              </View>
            </View>

            {/* Seamless, Non-Boxy System Settings Link */}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              onPress={handleOpenSettings}
              style={styles.framelessSettingsLink}
              accessibilityRole="button"
              accessibilityLabel="Open device settings"
            >
              <View style={styles.linkLeftGroup}>
                <SlidersHorizontal size={14} color={theme.colors.textTertiary} />
                <Text style={[styles.linkText, { color: theme.colors.textSecondary }]}>
                  Manage in System Settings
                </Text>
              </View>
              <ExternalLink size={13} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Clearance spacer to prevent content from hiding behind fixed floating dock */}
        <View style={styles.dockClearanceSpacer} />
      </Animated.ScrollView>

      {/* Floating Bottom Dock with Feathered Fade (Matches Discovery Preferences) */}
      <View style={styles.floatingDock} pointerEvents="box-none">
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.0)',
                  'rgba(11, 11, 14, 0.15)',
                  'rgba(11, 11, 14, 0.45)',
                  'rgba(11, 11, 14, 0.75)',
                  'rgba(11, 11, 14, 0.92)',
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 1.0)',
                  'rgba(11, 11, 14, 1.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.0)',
                  'rgba(250, 250, 250, 0.15)',
                  'rgba(250, 250, 250, 0.45)',
                  'rgba(250, 250, 250, 0.75)',
                  'rgba(250, 250, 250, 0.92)',
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 1.0)',
                  'rgba(250, 250, 250, 1.0)',
                ]
          }
          locations={[0, 0.04, 0.1, 0.16, 0.22, 0.3, 0.38, 1.0]}
          style={styles.dockGradientBackdrop}
          pointerEvents="none"
        />

        <View
          style={[
            styles.dockInner,
            {
              maxWidth: maxContentWidth || 520,
              paddingBottom: Math.max(insets.bottom + 14, 20),
            },
          ]}
        >
          {/* Professional Solid CTA Button with Instant Touch Feedback */}
          <TouchableOpacity
            onPress={handleContinue}
            delayPressIn={0}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#121216',
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: isDark ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.28 : 0.12,
              },
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Continue to Profile Preview"
            testID="permissions-continue-button"
          >
            <View style={styles.buttonInnerRow}>
              <Text
                style={[
                  styles.professionalCtaText,
                  {
                    color: isDark ? '#000000' : '#FFFFFF',
                    fontFamily: folkraFont,
                  },
                ]}
              >
                Continue to Preview
              </Text>
              <ArrowRight
                size={17}
                color={isDark ? '#000000' : '#FFFFFF'}
                style={{ marginLeft: 8 }}
              />
            </View>
          </TouchableOpacity>

          {/* Footnote reassurance */}
          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            Permissions can be refined anytime in your device or Nazar safety settings.
          </Text>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 35,
    flex: 1,
    flexShrink: 1,
  },
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
    paddingTop: 5,
  },
  stepCurrentText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stepDividerText: {
    fontSize: 14,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  stepTotalText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Fluid Sections Container with Compact Spacing
  fluidSectionsContainer: {
    gap: 12,
  },
  // Compact, Zero-Clipping, Identical Height Organic Surface
  fluidSurface: {
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  surfaceAccentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3.5,
  },
  fluidHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  fluidHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  organicIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  fluidTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusSubline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  fluidDescription: {
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  // Snappy Native-Driver Luxury Toggle Switch
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  switchTrackActive: {
    borderRadius: 13,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 3,
  },
  switchThumbActive: {
    borderRadius: 10,
  },
  // Editorial Trust Canvas (Non-Boxy Privacy Architecture)
  editorialTrustCanvas: {
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  atmosphericDividerContainer: {
    marginBottom: 14,
    alignItems: 'center',
  },
  atmosphericDividerLine: {
    width: '100%',
    height: 1,
  },
  trustSealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  shieldEmblem: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustSealTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  minimalPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  minimalPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  trustPrinciplesStack: {
    gap: 10,
    marginBottom: 14,
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  principleBullet: {
    paddingTop: 2,
    width: 16,
    alignItems: 'center',
  },
  principleContent: {
    flex: 1,
    gap: 2,
  },
  principleHeading: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  principleBody: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  framelessSettingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  linkLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  dockClearanceSpacer: {
    height: 140,
  },
  // Floating Bottom Dock with Feathered Fade
  floatingDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 18,
    zIndex: 30,
  },
  dockGradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockInner: {
    width: '100%',
    alignSelf: 'center',
  },
  professionalCtaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalCtaText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dockFootnoteText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
