import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  Wine,
  Cigarette,
  Dumbbell,
  Utensils,
  ShieldCheck,
  EyeOff,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

interface LifestyleOption {
  readonly id: string;
  readonly label: string;
  readonly isPreferNotToSay?: boolean;
}

interface LifestyleCategory {
  readonly id: 'drinking' | 'smoking' | 'workout' | 'dietary';
  readonly indexLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  readonly options: readonly LifestyleOption[];
}

const LIFESTYLE_CATEGORIES: readonly LifestyleCategory[] = [
  {
    id: 'drinking',
    indexLabel: '01',
    title: 'Drinking',
    subtitle: 'How often do you enjoy a drink?',
    icon: Wine,
    options: [
      { id: 'socially', label: 'Socially' },
      { id: 'occasions', label: 'On special occasions' },
      { id: 'regularly', label: 'Regularly' },
      { id: 'never', label: 'Teetotaler / Never' },
      { id: 'sober', label: 'Sober' },
      { id: 'not_say', label: 'Prefer not to say', isPreferNotToSay: true },
    ],
  },
  {
    id: 'smoking',
    indexLabel: '02',
    title: 'Smoking',
    subtitle: 'What is your smoking preference?',
    icon: Cigarette,
    options: [
      { id: 'non_smoker', label: 'Non-smoker' },
      { id: 'social_smoker', label: 'Social smoker' },
      { id: 'regular_smoker', label: 'Regular smoker' },
      { id: 'trying_to_quit', label: 'Trying to quit' },
      { id: 'vape_only', label: 'Vape only' },
      { id: 'not_say', label: 'Prefer not to say', isPreferNotToSay: true },
    ],
  },
  {
    id: 'workout',
    indexLabel: '03',
    title: 'Workout & Fitness',
    subtitle: 'How active are you in daily life?',
    icon: Dumbbell,
    options: [
      { id: 'everyday', label: 'Everyday' },
      { id: 'often', label: 'Often' },
      { id: 'sometimes', label: 'Sometimes' },
      { id: 'never', label: 'Never' },
      { id: 'not_say', label: 'Prefer not to say', isPreferNotToSay: true },
    ],
  },
  {
    id: 'dietary',
    indexLabel: '04',
    title: 'Dietary Preferences',
    subtitle: 'Your food lifestyle and choices',
    icon: Utensils,
    options: [
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'non_vegetarian', label: 'Non-vegetarian' },
      { id: 'eggetarian', label: 'Eggetarian' },
      { id: 'pescatarian', label: 'Pescatarian' },
      { id: 'jain', label: 'Jain' },
      { id: 'halal', label: 'Halal' },
      { id: 'not_say', label: 'Prefer not to say', isPreferNotToSay: true },
    ],
  },
];

export default function OnboardingLifestyleScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();

  const [fontsLoaded] = useFonts({
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftLifestyle, updateDraftLifestyle, setCurrentStep } = useOnboardingStore();

  const [selectedDrinking, setSelectedDrinking] = useState<string | undefined>(
    draftLifestyle.drinking
  );
  const [selectedSmoking, setSelectedSmoking] = useState<string | undefined>(
    draftLifestyle.smoking
  );
  const [selectedWorkout, setSelectedWorkout] = useState<string | undefined>(
    draftLifestyle.workout
  );
  const [selectedDietary, setSelectedDietary] = useState<string | undefined>(
    draftLifestyle.dietary
  );

  const [isLoading, setIsLoading] = useState(false);

  // Dynamic Scroll Vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 24, 64],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });

  useEffect(() => {
    trackOnboardingEvent('lifestyle_viewed');
    setCurrentStep('lifestyle');
  }, [setCurrentStep]);

  const handleSelectOption = (categoryId: string, optionId: string) => {
    haptics.selection();
    switch (categoryId) {
      case 'drinking':
        setSelectedDrinking((prev) => (prev === optionId ? undefined : optionId));
        break;
      case 'smoking':
        setSelectedSmoking((prev) => (prev === optionId ? undefined : optionId));
        break;
      case 'workout':
        setSelectedWorkout((prev) => (prev === optionId ? undefined : optionId));
        break;
      case 'dietary':
        setSelectedDietary((prev) => (prev === optionId ? undefined : optionId));
        break;
    }
  };

  const handlePreferNotToSayAll = () => {
    haptics.selection();
    setSelectedDrinking('not_say');
    setSelectedSmoking('not_say');
    setSelectedWorkout('not_say');
    setSelectedDietary('not_say');
  };

  // Micro-shake animation when attempting to continue without all selections
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -2.5, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 2.5, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();
  };

  const totalAnswered = [
    selectedDrinking,
    selectedSmoking,
    selectedWorkout,
    selectedDietary,
  ].filter(Boolean).length;
  const isAllAnswered = totalAnswered === 4;

  const handleNext = () => {
    if (!isAllAnswered) {
      haptics.notificationError();
      triggerShake();
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);

    const lifestyleData = {
      drinking: selectedDrinking,
      smoking: selectedSmoking,
      workout: selectedWorkout,
      dietary: selectedDietary,
    };

    updateDraftLifestyle(lifestyleData);
    trackOnboardingEvent('lifestyle_completed', {
      hasDrinking: !!selectedDrinking,
      hasSmoking: !!selectedSmoking,
      hasWorkout: !!selectedWorkout,
      hasDietary: !!selectedDietary,
    });

    setIsLoading(false);
    router.push('/(onboarding)/prompts');
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/interests');
    }
  };

  const getSelectedStateForCategory = (categoryId: string): string | undefined => {
    switch (categoryId) {
      case 'drinking':
        return selectedDrinking;
      case 'smoking':
        return selectedSmoking;
      case 'workout':
        return selectedWorkout;
      case 'dietary':
        return selectedDietary;
      default:
        return undefined;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Specular Top Vignette (Fades in dynamically on scroll) */}
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

      {/* Floating Encircled Back Button */}
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

      {/* Scrollable Content Body */}
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth || 540,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 64, 76),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Title Section with Aligned 04 / 07 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              Lifestyle & Habits
            </Heading>
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                04
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
            Share your day-to-day rhythm and personal choices. All answers are flexible and strictly
            optional.
          </Text>
        </View>

        {/* Boxless Lifestyle Sections Flow with Shake Feedback */}
        <Animated.View
          style={[styles.boxlessSectionsList, { transform: [{ translateX: shakeAnim }] }]}
        >
          {LIFESTYLE_CATEGORIES.map((category, index) => {
            const selectedOptionId = getSelectedStateForCategory(category.id);
            const IconComponent = category.icon;

            return (
              <View key={category.id} style={styles.boxlessSection}>
                {/* Section Header Row */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <View
                      style={[
                        styles.sectionIconGlyph,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.04)',
                        },
                      ]}
                    >
                      <IconComponent size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: theme.colors.textPrimary, fontFamily: folkraFont },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {category.title}
                    </Text>
                  </View>
                </View>

                {/* Subtitle */}
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textTertiary }]}>
                  {category.subtitle}
                </Text>

                {/* Fluid Pill Chips Container */}
                <View style={styles.fluidPillsRow}>
                  {category.options.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isOptionNotToSay = !!option.isPreferNotToSay;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => handleSelectOption(category.id, option.id)}
                        activeOpacity={0.78}
                        style={[
                          styles.fluidPill,
                          {
                            backgroundColor: isSelected
                              ? isOptionNotToSay
                                ? isDark
                                  ? 'rgba(255, 255, 255, 0.12)'
                                  : 'rgba(0, 0, 0, 0.08)'
                                : isDark
                                  ? '#FFFFFF'
                                  : '#121216'
                              : isOptionNotToSay
                                ? 'transparent'
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.04)'
                                  : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isSelected
                              ? isOptionNotToSay
                                ? isDark
                                  ? 'rgba(255, 255, 255, 0.28)'
                                  : 'rgba(0, 0, 0, 0.22)'
                                : isDark
                                  ? '#FFFFFF'
                                  : '#121216'
                              : isOptionNotToSay
                                ? isDark
                                  ? 'rgba(255, 255, 255, 0.14)'
                                  : 'rgba(0, 0, 0, 0.12)'
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.09)'
                                  : 'rgba(0, 0, 0, 0.07)',
                            borderStyle: isOptionNotToSay ? 'dashed' : 'solid',
                            shadowOpacity: isSelected && !isOptionNotToSay ? 0.14 : 0,
                          },
                        ]}
                      >
                        {isOptionNotToSay && (
                          <EyeOff
                            size={11}
                            color={
                              isSelected ? theme.colors.textPrimary : theme.colors.textTertiary
                            }
                            strokeWidth={2}
                            style={{ marginRight: 5 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.fluidPillText,
                            {
                              color: isSelected
                                ? isOptionNotToSay
                                  ? theme.colors.textPrimary
                                  : isDark
                                    ? '#121216'
                                    : '#FFFFFF'
                                : isOptionNotToSay
                                  ? theme.colors.textSecondary
                                  : theme.colors.textPrimary,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Delicate Hairline Separator Between Sections */}
                {index < LIFESTYLE_CATEGORIES.length - 1 && (
                  <View
                    style={[
                      styles.hairlineDivider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}

          {/* Boxless Editorial Privacy Callout */}
          <View style={styles.editorialPrivacyBlock}>
            <View
              style={[
                styles.privacyIconGlow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)',
                },
              ]}
            >
              <ShieldCheck size={16} color={theme.colors.textSecondary} strokeWidth={2.2} />
            </View>
            <Text style={[styles.editorialPrivacyText, { color: theme.colors.textSecondary }]}>
              Options marked <Text style={{ fontWeight: '700' }}>Prefer not to say</Text> are never
              displayed on your public profile. Selected habits can be shown as profile badges or
              kept hidden in Settings anytime.
            </Text>
          </View>
        </Animated.View>

        {/* Clearance spacer so content isn't obscured by floating dock */}
        <View style={styles.dockClearanceSpacer} />
      </Animated.ScrollView>

      {/* Floating Bottom Dock with Feathered Gradient Fade */}
      <View style={styles.floatingDock} pointerEvents="box-none">
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
              maxWidth: maxContentWidth || 540,
              paddingBottom: Math.max(insets.bottom + 14, 20),
            },
          ]}
        >
          {/* Quick Option to Keep All Private / Prefer Not to Say All */}
          {totalAnswered === 0 && (
            <TouchableOpacity
              onPress={handlePreferNotToSayAll}
              activeOpacity={0.7}
              style={styles.preferNotToSayAllButton}
            >
              <Text style={[styles.preferNotToSayAllText, { color: theme.colors.textSecondary }]}>
                Prefer not to say for all
              </Text>
            </TouchableOpacity>
          )}

          {/* Professional Solid / Greyed-out CTA Button */}
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
                opacity: isLoading ? 0.75 : isAllAnswered ? 1 : 0.6,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isAllAnswered
                ? 'Continue to personality prompts'
                : `Select all 4 habits (${totalAnswered} of 4 selected)`
            }
            testID="lifestyle-continue-button"
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
                  {isAllAnswered
                    ? 'Continue to Prompts'
                    : `Select All 4 Habits (${totalAnswered}/4)`}
                </Text>
                {isAllAnswered && (
                  <ArrowRight size={17} color="#000000" style={{ marginLeft: 8 }} />
                )}
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            You can change or hide lifestyle details anytime in Profile Settings.
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
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
    marginBottom: 20,
  },
  // Boxless Sections List
  boxlessSectionsList: {
    marginTop: 8,
  },
  boxlessSection: {
    paddingVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 3,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    gap: 8,
  },
  sectionIconGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 13,
    lineHeight: 16,
    paddingLeft: 34,
  },
  fluidPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 34,
  },
  fluidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13.5,
    paddingVertical: 8.5,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  fluidPillText: {
    fontSize: 12.5,
    letterSpacing: 0.15,
  },
  hairlineDivider: {
    height: 1,
    marginTop: 22,
    marginBottom: 16,
    marginLeft: 34,
  },
  editorialPrivacyBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
    paddingLeft: 4,
  },
  privacyIconGlow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  editorialPrivacyText: {
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 17,
    flex: 1,
  },
  dockClearanceSpacer: {
    height: 155,
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
  preferNotToSayAllButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  preferNotToSayAllText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
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
