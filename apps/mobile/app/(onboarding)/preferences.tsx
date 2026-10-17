import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

const GENDER_OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: 'Men', value: 'MAN' },
  { label: 'Women', value: 'WOMAN' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Everyone', value: 'OTHER' },
];

const DISTANCE_PRESETS = [10, 25, 50, 100, 200];

export default function OnboardingPreferencesScreen(): React.JSX.Element {
  const router = useRouter();
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

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftPreferences, updateDraftPreferences } = useOnboardingStore();

  const [minAge, setMinAge] = useState<number>(draftPreferences.minAge || 21);
  const [maxAge, setMaxAge] = useState<number>(draftPreferences.maxAge || 35);
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>(
    draftPreferences.genderPreferences || ['MAN']
  );
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(draftPreferences.maxDistanceKm || 50);
  const [intent] = useState<RelationshipIntent>(draftPreferences.relationshipIntent || 'LONG_TERM');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const toggleGender = (val: Gender) => {
    haptics.selection();
    if (selectedGenders.includes(val)) {
      if (selectedGenders.length <= 1) return; // Keep at least one
      setSelectedGenders(selectedGenders.filter((g) => g !== val));
    } else {
      setSelectedGenders([...selectedGenders, val]);
    }
  };

  const handleNext = async () => {
    if (minAge < 18) {
      haptics.notificationError();
      setErrorMessage('Minimum age preference must be at least 18.');
      return;
    }
    if (minAge > maxAge) {
      haptics.notificationError();
      setErrorMessage('Minimum age cannot be greater than maximum age.');
      return;
    }
    if (selectedGenders.length === 0) {
      haptics.notificationError();
      setErrorMessage('Please select who you are interested in discovering.');
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    updateDraftPreferences({
      minAge,
      maxAge,
      genderPreferences: selectedGenders,
      maxDistanceKm,
      relationshipIntent: intent,
    });

    try {
      await profileApi.updatePreferences({
        minAge,
        maxAge,
        genderPreferences: selectedGenders,
        maxDistanceKm,
        relationshipIntent: intent,
      });

      trackOnboardingEvent('preferences_completed', {
        minAge,
        maxAge,
        maxDistanceKm,
      });

      router.push('/(onboarding)/permissions');
    } catch {
      // Local fallback
      trackOnboardingEvent('preferences_completed', {
        minAge,
        maxAge,
        maxDistanceKm,
      });
      router.push('/(onboarding)/permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/prompts');
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
              Discovery Preferences
            </Heading>
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                05
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
                06
              </Text>
            </View>
          </View>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Set your ideal match preferences. You can always refine these in settings later.
          </Text>
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error },
            ]}
          >
            <Text level="bodySmall" style={{ color: theme.colors.error, fontWeight: '600' }}>
              {errorMessage}
            </Text>
          </View>
        )}

        <View style={styles.sectionContainer}>
          {/* Interested in */}
          <View style={styles.section}>
            <Text
              level="title"
              style={{ color: theme.colors.textPrimary, fontWeight: '700', fontFamily: folkraFont }}
            >
              Interested in Meeting
            </Text>
            <View style={styles.pillRow}>
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = selectedGenders.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleGender(opt.value)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.surfaceMuted,
                        borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${opt.label}, ${isSelected ? 'selected' : 'not selected'}`}
                  >
                    <Text
                      level="bodySmall"
                      style={{
                        color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Age range */}
          <SurfaceCard elevation="none" style={[styles.card, { borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text
                level="title"
                style={{
                  color: theme.colors.textPrimary,
                  fontWeight: '700',
                  fontFamily: folkraFont,
                }}
              >
                Age Range
              </Text>
              <Text level="body" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                {minAge} – {maxAge} years
              </Text>
            </View>

            <View style={styles.ageSteppersRow}>
              <View style={styles.stepperCol}>
                <Text level="caption" color="secondary">
                  Min Age: {minAge}
                </Text>
                <View style={styles.stepperBtns}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setMinAge((prev) => Math.max(18, prev - 1));
                    }}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease minimum age"
                  >
                    <Icon name="minus" size="xs" color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setMinAge((prev) => Math.min(maxAge - 1, prev + 1));
                    }}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase minimum age"
                  >
                    <Icon name="plus" size="xs" color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperCol}>
                <Text level="caption" color="secondary">
                  Max Age: {maxAge}
                </Text>
                <View style={styles.stepperBtns}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setMaxAge((prev) => Math.max(minAge + 1, prev - 1));
                    }}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease maximum age"
                  >
                    <Icon name="minus" size="xs" color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setMaxAge((prev) => Math.min(70, prev + 1));
                    }}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase maximum age"
                  >
                    <Icon name="plus" size="xs" color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SurfaceCard>

          {/* Maximum distance */}
          <SurfaceCard elevation="none" style={[styles.card, { borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text
                level="title"
                style={{
                  color: theme.colors.textPrimary,
                  fontWeight: '700',
                  fontFamily: folkraFont,
                }}
              >
                Maximum Distance
              </Text>
              <Text level="body" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                Up to {maxDistanceKm} km
              </Text>
            </View>

            <View style={styles.pillRow}>
              {DISTANCE_PRESETS.map((d) => {
                const isSelected = maxDistanceKm === d;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => {
                      haptics.selection();
                      setMaxDistanceKm(d);
                    }}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.surfaceMuted,
                        borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set max distance to ${d} kilometers`}
                  >
                    <Text
                      level="bodySmall"
                      style={{
                        color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {d} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            onPress={handleNext}
            accessibilityLabel="Continue to permissions"
          >
            Continue
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
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionContainer: {
    marginVertical: 24,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ageSteppersRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stepperCol: {
    flex: 1,
    gap: 6,
  },
  stepperBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
