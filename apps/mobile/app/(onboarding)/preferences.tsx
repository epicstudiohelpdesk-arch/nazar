import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Calendar, MapPin, Minus, Plus, Compass } from 'lucide-react-native';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

interface AgePreset {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly subtitle: string;
}

const AGE_PRESETS: readonly AgePreset[] = [
  { label: '18 – 24', min: 18, max: 24, subtitle: 'Early 20s' },
  { label: '21 – 29', min: 21, max: 29, subtitle: 'Twenties' },
  { label: '24 – 35', min: 24, max: 35, subtitle: 'Prime' },
  { label: '28 – 45', min: 28, max: 45, subtitle: 'Established' },
  { label: 'All Ages', min: 18, max: 70, subtitle: '18 – 70+' },
];

interface DistancePreset {
  readonly km: number;
  readonly label: string;
  readonly subtitle: string;
}

const DISTANCE_PRESETS: readonly DistancePreset[] = [
  { km: 10, label: '10 km', subtitle: 'Neighborhood' },
  { km: 25, label: '25 km', subtitle: 'City core' },
  { km: 50, label: '50 km', subtitle: 'Metro area' },
  { km: 100, label: '100 km', subtitle: 'Regional' },
  { km: 200, label: '200 km', subtitle: 'Nationwide' },
];

const getDistanceDescriptor = (km: number): string => {
  if (km <= 15) return 'Focused on your immediate neighborhood and local walking radius';
  if (km <= 35) return 'City-wide discovery across your urban center and districts';
  if (km <= 75) return 'Expands to greater metropolitan and neighboring commuter areas';
  if (km <= 150) return 'Broader regional radar across adjacent cities and counties';
  return 'Nationwide discovery across states and the entire country';
};

export default function OnboardingPreferencesScreen(): React.JSX.Element {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const isFromReview = returnTo === 'preview';
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

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

  // Micro-shake animation for validation failure
  const cardShakeAnim = useRef(new Animated.Value(0)).current;
  const triggerCardShake = () => {
    Animated.sequence([
      Animated.timing(cardShakeAnim, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(cardShakeAnim, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(cardShakeAnim, { toValue: -2, duration: 40, useNativeDriver: true }),
      Animated.timing(cardShakeAnim, { toValue: 2, duration: 45, useNativeDriver: true }),
      Animated.timing(cardShakeAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
  };

  // Auto-dismissing validation notification pill (1.3s)
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const errorAnim = useRef(new Animated.Value(0)).current;
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showErrorNotification = (msg: string) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setErrorMessage(msg);
    Animated.timing(errorAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    errorTimeoutRef.current = setTimeout(() => {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setErrorMessage(undefined);
      });
    }, 1300);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftPreferences, updateDraftPreferences, draftProfile } = useOnboardingStore();

  const [minAge, setMinAge] = useState<number>(draftPreferences.minAge || 21);
  const [maxAge, setMaxAge] = useState<number>(draftPreferences.maxAge || 35);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(draftPreferences.maxDistanceKm || 50);
  const [intent] = useState<RelationshipIntent>(
    draftPreferences.relationshipIntent || draftProfile.intent || 'LONG_TERM'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // User's gender preferences already collected in "The Basics"
  const genderPreferences =
    draftPreferences.genderPreferences && draftPreferences.genderPreferences.length > 0
      ? draftPreferences.genderPreferences
      : draftProfile.gender === 'MAN'
        ? (['WOMAN'] as Gender[])
        : (['MAN'] as Gender[]);

  const handleApplyAgePreset = (preset: AgePreset) => {
    haptics.selection();
    setHasInteracted(true);
    setMinAge(preset.min);
    setMaxAge(preset.max);
  };

  const handleApplyDistancePreset = (km: number) => {
    haptics.selection();
    setHasInteracted(true);
    setMaxDistanceKm(km);
  };

  const handleNext = async () => {
    if (minAge < 18) {
      haptics.notificationError();
      showErrorNotification('Minimum age preference must be at least 18.');
      triggerCardShake();
      return;
    }
    if (minAge > maxAge) {
      haptics.notificationError();
      showErrorNotification('Minimum age cannot be greater than maximum age.');
      triggerCardShake();
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    updateDraftPreferences({
      minAge,
      maxAge,
      genderPreferences,
      maxDistanceKm,
      relationshipIntent: intent,
    });

    try {
      await profileApi.updatePreferences({
        minAge,
        maxAge,
        genderPreferences,
        maxDistanceKm,
        relationshipIntent: intent,
      });

      trackOnboardingEvent('preferences_completed', {
        minAge,
        maxAge,
        maxDistanceKm,
      });

      if (isFromReview) {
        router.replace('/(onboarding)/preview');
        return;
      }
      router.push('/(onboarding)/permissions');
    } catch {
      // Local fallback
      trackOnboardingEvent('preferences_completed', {
        minAge,
        maxAge,
        maxDistanceKm,
      });
      if (isFromReview) {
        router.replace('/(onboarding)/preview');
        return;
      }
      router.push('/(onboarding)/permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    haptics.impactLight();
    if (isFromReview) {
      router.replace('/(onboarding)/preview');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/prompts');
    }
  };

  // Visual calculation for age range slider track
  const ageSpanTotal = 70 - 18;
  const minAgePercent = Math.max(0, Math.min(100, ((minAge - 18) / ageSpanTotal) * 100));
  const maxAgePercent = Math.max(0, Math.min(100, ((maxAge - 18) / ageSpanTotal) * 100));

  // Visual calculation for distance slider track
  const distancePercent = Math.max(0, Math.min(100, ((maxDistanceKm - 5) / (200 - 5)) * 100));

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
        {/* Header Title Section: Properly Padded & Non-Clipping 05/06 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              Discovery Preferences
            </Heading>
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                06
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
            Set your ideal match preferences. You can always refine these in settings later.
          </Text>
        </View>

        {/* Compact, Professional Validation Pill (Auto-dismisses in 1.3s) */}
        {errorMessage && (
          <Animated.View
            style={[
              styles.compactErrorPill,
              {
                backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.05)',
                borderColor: isDark ? 'rgba(244, 63, 94, 0.24)' : 'rgba(244, 63, 94, 0.18)',
                opacity: errorAnim,
              },
            ]}
          >
            <View style={styles.compactErrorDot} />
            <Text style={[styles.compactErrorText, { color: isDark ? '#FDA4AF' : '#E11D48' }]}>
              {errorMessage}
            </Text>
          </Animated.View>
        )}

        {/* Main Content Sections Stack with Micro-Shake */}
        <Animated.View
          style={[styles.sectionContainer, { transform: [{ translateX: cardShakeAnim }] }]}
        >
          {/* ======================================================== */}
          {/* Section 1: Age Range (Dual Precision Controls + Presets) */}
          {/* ======================================================== */}
          <View
            style={[
              styles.luxuryCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E4E4E7',
              },
            ]}
          >
            {/* Header Row: Title on Left, Scaled White Capsule on Right */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.cardIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Calendar size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <Text
                  style={[
                    styles.cardSectionTitle,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: folkraFont,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Age Range
                </Text>
              </View>

              {/* Perfectly Proportioned White Capsule */}
              <View
                style={[
                  styles.valueCapsuleBadge,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#121216',
                    borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.valueCapsuleText,
                    {
                      color: isDark ? '#121216' : '#FFFFFF',
                    },
                  ]}
                >
                  {minAge} – {maxAge >= 70 ? '70+' : maxAge} yrs
                </Text>
              </View>
            </View>

            {/* Subtitle placed with clean vertical rhythm */}
            <Text style={[styles.cardSectionSubtitle, { color: theme.colors.textTertiary }]}>
              Between {minAge} and {maxAge >= 70 ? '70+' : maxAge} years old
            </Text>

            {/* Visual Age Range Spectrum Bar */}
            <View style={styles.spectrumBarWrapper}>
              <View
                style={[
                  styles.spectrumTrackBackground,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.spectrumFillSpan,
                    {
                      left: `${minAgePercent}%`,
                      width: `${Math.max(4, maxAgePercent - minAgePercent)}%`,
                      backgroundColor: isDark ? '#FFFFFF' : '#121216',
                    },
                  ]}
                />
              </View>
              <View style={styles.spectrumLabelsRow}>
                <Text style={[styles.spectrumLimitLabel, { color: theme.colors.textTertiary }]}>
                  18 yrs
                </Text>
                <Text style={[styles.spectrumLimitLabel, { color: theme.colors.textTertiary }]}>
                  70+ yrs
                </Text>
              </View>
            </View>

            {/* Symmetrical Dual Precision Stepper Pods */}
            <View style={styles.steppersGridRow}>
              {/* Minimum Age Stepper Pod */}
              <View
                style={[
                  styles.stepperContainerCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                  },
                ]}
              >
                <Text style={[styles.stepperMiniHeader, { color: theme.colors.textTertiary }]}>
                  Minimum Age
                </Text>
                <View style={styles.stepperControlRow}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setHasInteracted(true);
                      setMinAge((prev) => Math.max(18, prev - 1));
                    }}
                    disabled={minAge <= 18}
                    style={[
                      styles.stepperIconButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        opacity: minAge <= 18 ? 0.35 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease minimum age"
                  >
                    <Minus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
                  </TouchableOpacity>

                  <Text
                    style={[
                      styles.stepperBigValue,
                      { color: theme.colors.textPrimary, fontFamily: folkraFont },
                    ]}
                  >
                    {minAge}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setHasInteracted(true);
                      setMinAge((prev) => Math.min(maxAge - 1, prev + 1));
                    }}
                    disabled={minAge >= maxAge - 1}
                    style={[
                      styles.stepperIconButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        opacity: minAge >= maxAge - 1 ? 0.35 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase minimum age"
                  >
                    <Plus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Maximum Age Stepper Pod */}
              <View
                style={[
                  styles.stepperContainerCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                  },
                ]}
              >
                <Text style={[styles.stepperMiniHeader, { color: theme.colors.textTertiary }]}>
                  Maximum Age
                </Text>
                <View style={styles.stepperControlRow}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setHasInteracted(true);
                      setMaxAge((prev) => Math.max(minAge + 1, prev - 1));
                    }}
                    disabled={maxAge <= minAge + 1}
                    style={[
                      styles.stepperIconButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        opacity: maxAge <= minAge + 1 ? 0.35 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease maximum age"
                  >
                    <Minus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
                  </TouchableOpacity>

                  <Text
                    style={[
                      styles.stepperBigValue,
                      { color: theme.colors.textPrimary, fontFamily: folkraFont },
                    ]}
                  >
                    {maxAge >= 70 ? '70+' : maxAge}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setHasInteracted(true);
                      setMaxAge((prev) => Math.min(70, prev + 1));
                    }}
                    disabled={maxAge >= 70}
                    style={[
                      styles.stepperIconButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        opacity: maxAge >= 70 ? 0.35 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase maximum age"
                  >
                    <Plus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Quick Bracket Preset Chips */}
            <View style={styles.presetChipsWrapper}>
              <Text style={[styles.presetSectionLabel, { color: theme.colors.textTertiary }]}>
                Quick Brackets
              </Text>
              <View style={styles.presetChipsRow}>
                {AGE_PRESETS.map((preset) => {
                  const isPresetActive = minAge === preset.min && maxAge === preset.max;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => handleApplyAgePreset(preset)}
                      activeOpacity={0.75}
                      style={[
                        styles.quickPresetChip,
                        {
                          backgroundColor: isPresetActive
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isPresetActive
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.09)'
                              : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickPresetChipText,
                          {
                            color: isPresetActive
                              ? isDark
                                ? '#121216'
                                : '#FFFFFF'
                              : theme.colors.textPrimary,
                            fontWeight: isPresetActive ? '700' : '500',
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ======================================================== */}
          {/* Section 2: Maximum Distance (Radius Radar + Scope)       */}
          {/* ======================================================== */}
          <View
            style={[
              styles.luxuryCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E4E4E7',
              },
            ]}
          >
            {/* Header Row: Title on Left, Scaled White Capsule on Right */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.cardIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <MapPin size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <Text
                  style={[
                    styles.cardSectionTitle,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: folkraFont,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Maximum Distance
                </Text>
              </View>

              {/* Perfectly Proportioned White Capsule */}
              <View
                style={[
                  styles.valueCapsuleBadge,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#121216',
                    borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.valueCapsuleText,
                    {
                      color: isDark ? '#121216' : '#FFFFFF',
                    },
                  ]}
                >
                  {maxDistanceKm >= 200 ? '200+ km' : `Within ${maxDistanceKm} km`}
                </Text>
              </View>
            </View>

            {/* Subtitle placed with clean vertical rhythm */}
            <Text style={[styles.cardSectionSubtitle, { color: theme.colors.textTertiary }]}>
              Search radius for potential matches
            </Text>

            {/* Visual Distance Progress Bar */}
            <View style={styles.spectrumBarWrapper}>
              <View
                style={[
                  styles.spectrumTrackBackground,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.spectrumFillSpan,
                    {
                      left: '0%',
                      width: `${distancePercent}%`,
                      backgroundColor: isDark ? '#FFFFFF' : '#121216',
                    },
                  ]}
                />
              </View>
              <View style={styles.spectrumLabelsRow}>
                <Text style={[styles.spectrumLimitLabel, { color: theme.colors.textTertiary }]}>
                  5 km (Local)
                </Text>
                <Text style={[styles.spectrumLimitLabel, { color: theme.colors.textTertiary }]}>
                  200+ km (Nationwide)
                </Text>
              </View>
            </View>

            {/* Aligned Stepper Pod */}
            <View
              style={[
                styles.distanceFineTuneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setHasInteracted(true);
                  setMaxDistanceKm((prev) => Math.max(5, prev - 5));
                }}
                disabled={maxDistanceKm <= 5}
                style={[
                  styles.stepperIconButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    opacity: maxDistanceKm <= 5 ? 0.35 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Decrease distance"
              >
                <Minus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
              </TouchableOpacity>

              <View style={styles.distanceDisplayCenter}>
                <Text
                  style={[
                    styles.distanceBigNumber,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  {maxDistanceKm >= 200 ? '200+' : maxDistanceKm}{' '}
                  <Text style={[styles.distanceKmUnit, { color: theme.colors.textTertiary }]}>
                    km
                  </Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setHasInteracted(true);
                  setMaxDistanceKm((prev) => Math.min(200, prev + 5));
                }}
                disabled={maxDistanceKm >= 200}
                style={[
                  styles.stepperIconButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    opacity: maxDistanceKm >= 200 ? 0.35 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Increase distance"
              >
                <Plus size={14} color={theme.colors.textPrimary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Curated Distance Preset Pills */}
            <View style={styles.presetChipsWrapper}>
              <Text style={[styles.presetSectionLabel, { color: theme.colors.textTertiary }]}>
                Standard Radii
              </Text>
              <View style={styles.presetChipsRow}>
                {DISTANCE_PRESETS.map((preset) => {
                  const isPresetActive = maxDistanceKm === preset.km;
                  return (
                    <TouchableOpacity
                      key={`dist-${preset.km}`}
                      onPress={() => handleApplyDistancePreset(preset.km)}
                      activeOpacity={0.75}
                      style={[
                        styles.quickPresetChip,
                        {
                          backgroundColor: isPresetActive
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isPresetActive
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.09)'
                              : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickPresetChipText,
                          {
                            color: isPresetActive
                              ? isDark
                                ? '#121216'
                                : '#FFFFFF'
                              : theme.colors.textPrimary,
                            fontWeight: isPresetActive ? '700' : '500',
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Dynamic Contextual Descriptor */}
            <View
              style={[
                styles.contextualScopeCallout,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Compass
                size={13}
                color={theme.colors.textSecondary}
                strokeWidth={2}
                style={{ marginRight: 7, marginTop: 1 }}
              />
              <Text style={[styles.contextualScopeText, { color: theme.colors.textSecondary }]}>
                {getDistanceDescriptor(maxDistanceKm)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom clearance spacer for floating dock */}
        <View style={styles.dockClearanceSpacer} />
      </Animated.ScrollView>

      {/* ======================================================== */}
      {/* Floating Bottom Action Dock with 8-Stop Feather Fade     */}
      {/* ======================================================== */}
      <View style={styles.floatingDock} pointerEvents="box-none">
        {/* Soft, Natural Feathered Fade Above the Button */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.0)',
                  'rgba(11, 11, 14, 0.05)',
                  'rgba(11, 11, 14, 0.16)',
                  'rgba(11, 11, 14, 0.38)',
                  'rgba(11, 11, 14, 0.68)',
                  'rgba(11, 11, 14, 0.90)',
                  'rgba(11, 11, 14, 1.0)',
                  'rgba(11, 11, 14, 1.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.0)',
                  'rgba(250, 250, 250, 0.05)',
                  'rgba(250, 250, 250, 0.16)',
                  'rgba(250, 250, 250, 0.38)',
                  'rgba(250, 250, 250, 0.68)',
                  'rgba(250, 250, 250, 0.90)',
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
          {/* Professional Solid CTA Button */}
          <TouchableOpacity
            onPress={handleNext}
            disabled={isLoading}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: isDark ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.28 : 0.12,
                opacity: isLoading ? 0.75 : hasInteracted ? 1 : 0.6,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={isFromReview ? 'Back to Review' : 'Continue to permissions'}
            testID="preferences-continue-button"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: '#000000',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  {isFromReview ? 'Back to Review' : 'Continue'}
                </Text>
                <ArrowRight size={17} color="#000000" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* Footnote reassurance */}
          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            Preferences can be adjusted anytime in your discovery filters.
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
  // Compact Validation Notification Pill (1.3s)
  compactErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  compactErrorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F43F5E',
    marginRight: 8,
  },
  compactErrorText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // Section Cards Container
  sectionContainer: {
    gap: 16,
  },
  luxuryCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    gap: 8,
  },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  cardSectionSubtitle: {
    fontSize: 11.5,
    marginTop: 4,
    marginBottom: 16,
  },
  // Scaled & Compact Value Capsule (White Capsule)
  valueCapsuleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  valueCapsuleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
    includeFontPadding: false,
  },
  // Visual Spectrum Bar
  spectrumBarWrapper: {
    marginBottom: 16,
  },
  spectrumTrackBackground: {
    height: 5,
    borderRadius: 2.5,
    position: 'relative',
    overflow: 'hidden',
  },
  spectrumFillSpan: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2.5,
  },
  spectrumLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  spectrumLimitLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Dual Stepper Columns
  steppersGridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  stepperContainerCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stepperMiniHeader: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  stepperControlRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBigValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    flex: 1,
  },
  stepperIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quick Presets
  presetChipsWrapper: {
    gap: 6,
  },
  presetSectionLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  quickPresetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickPresetChipText: {
    fontSize: 12,
    letterSpacing: 0.15,
  },
  // Distance Fine Tune Row
  distanceFineTuneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 16,
  },
  distanceDisplayCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBigNumber: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  distanceKmUnit: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  contextualScopeCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  contextualScopeText: {
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
    flex: 1,
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
