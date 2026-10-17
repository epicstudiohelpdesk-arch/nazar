import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { InterestItem } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

// Canonical fallback taxonomy curated for authentic Indian nuances
const FALLBACK_INTERESTS: InterestItem[] = [
  { id: 'int_1', name: 'Filter Coffee ☕', slug: 'filter-coffee', category: 'Food & Drink' },
  { id: 'int_2', name: 'Hindustani Classical 🎵', slug: 'hindustani-classical', category: 'Music' },
  { id: 'int_3', name: 'Indie Cinema 🎬', slug: 'indie-cinema', category: 'Arts & Culture' },
  { id: 'int_4', name: 'Street Food & Chaat 🥟', slug: 'street-food', category: 'Food & Drink' },
  { id: 'int_5', name: 'Weekend Trekking ⛰️', slug: 'weekend-trekking', category: 'Outdoors' },
  { id: 'int_6', name: 'Modern Indian Art 🎨', slug: 'modern-art', category: 'Arts & Culture' },
  { id: 'int_7', name: 'Books & Literature 📚', slug: 'books-literature', category: 'Lifestyle' },
  { id: 'int_8', name: 'Cricket & IPL 🏏', slug: 'cricket', category: 'Sports' },
  { id: 'int_9', name: 'Board Games & Catan 🎲', slug: 'board-games', category: 'Lifestyle' },
  {
    id: 'int_10',
    name: 'Architecture & Heritage 🏛️',
    slug: 'architecture',
    category: 'Arts & Culture',
  },
  { id: 'int_11', name: 'Yoga & Mindfulness 🧘', slug: 'yoga-mindfulness', category: 'Wellness' },
  { id: 'int_12', name: 'Live Indie Gigs 🎸', slug: 'live-gigs', category: 'Music' },
  { id: 'int_13', name: 'Sufi & Ghazals 🎶', slug: 'sufi-ghazals', category: 'Music' },
  { id: 'int_14', name: 'Heritage Walks 🚶‍♂️', slug: 'heritage-walks', category: 'Outdoors' },
  {
    id: 'int_15',
    name: 'Home Cooking & Spices 🥘',
    slug: 'home-cooking',
    category: 'Food & Drink',
  },
  { id: 'int_16', name: 'Poetry & Shayari ✍️', slug: 'poetry-shayari', category: 'Arts & Culture' },
];

export default function OnboardingInterestsScreen(): React.JSX.Element {
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

  const { draftInterests, toggleDraftInterest } = useOnboardingStore();

  const [availableInterests, setAvailableInterests] = useState<InterestItem[]>(FALLBACK_INTERESTS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    trackOnboardingEvent('interests_viewed');
    let isMounted = true;

    (async () => {
      try {
        const taxonomy = await profileApi.getInterestsTaxonomy();
        if (isMounted && taxonomy && taxonomy.length > 0) {
          setAvailableInterests(taxonomy);
        }
      } catch {
        // Fallback taxonomy used gracefully
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = (id: string) => {
    const isSelected = draftInterests.includes(id);
    if (!isSelected && draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 interests.');
      return;
    }

    haptics.selection();
    toggleDraftInterest(id);
    if (errorMessage) setErrorMessage(undefined);

    if (isSelected) {
      trackOnboardingEvent('interest_deselected', { interestId: id });
    } else {
      trackOnboardingEvent('interest_selected', { interestId: id });
    }
  };

  const handleNext = async () => {
    if (draftInterests.length < 3) {
      haptics.notificationError();
      setErrorMessage('Please select at least 3 interests that represent you.');
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      await profileApi.updateMyInterests({ interestIds: draftInterests });
      trackOnboardingEvent('interests_completed', { count: draftInterests.length });
      router.push('/(onboarding)/prompts');
    } catch {
      // Offline fallback: store holds draft and flow continues
      trackOnboardingEvent('interests_completed', { count: draftInterests.length });
      router.push('/(onboarding)/prompts');
    } finally {
      setIsLoading(false);
    }
  };

  // Group available interests by category
  const categories = Array.from(
    new Set(availableInterests.map((item) => item.category || 'General'))
  );

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/photos');
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
              What are you into?
            </Heading>
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                03
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
            Select 3 to 10 passions to help us curate profiles who share your rhythm.
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

        <View style={styles.categoriesContainer}>
          {categories.map((category) => {
            const items = availableInterests.filter((i) => (i.category || 'General') === category);

            return (
              <View key={category} style={styles.categorySection}>
                <Text
                  level="title"
                  style={[
                    styles.categoryTitle,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  {category}
                </Text>
                <View style={styles.chipRow}>
                  {items.map((item) => {
                    const isSelected = draftInterests.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleToggle(item.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.accent
                              : theme.colors.surfaceMuted,
                            borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                          },
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'not selected'}`}
                      >
                        <Text
                          level="bodySmall"
                          style={{
                            color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          }}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={draftInterests.length < 3}
            onPress={handleNext}
            accessibilityLabel={`Continue to prompts (${draftInterests.length} of 3 required selected)`}
          >
            {draftInterests.length < 3
              ? `Select at least 3 interests (${draftInterests.length}/3)`
              : `Continue (${draftInterests.length} Selected)`}
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
  categoriesContainer: {
    marginVertical: 20,
    gap: 20,
  },
  categorySection: {
    gap: 10,
  },
  categoryTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
