import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { SmoothBottomSheetModal } from '../../src/design/components/modal/SmoothBottomSheetModal.js';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Check,
  Plus,
  Sparkles,
  Coffee,
  Music,
  Film,
  UtensilsCrossed,
  Mountain,
  Palette,
  Camera,
  BookOpen,
  Trophy,
  Activity,
  Gamepad2,
  Landmark,
  Sun,
  PenTool,
  Plane,
  Heart,
  Code,
  Cpu,
  Feather,
  Footprints,
  Dumbbell,
  Wine,
  Headphones,
  AlertCircle,
} from 'lucide-react-native';
import type { InterestItem } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

// ============================================================================
// Robust Emoji Stripping Sanitizer
// Ensures 100% professional textual integrity across server & user inputs
// ============================================================================

export const cleanInterestName = (name: string): string => {
  return name
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}]/gu,
      ''
    )
    .replace(/[\uFE00-\uFE0F\u200D]/g, '')
    .trim();
};

// ============================================================================
// Curated Authentic Fallback Taxonomy (100% Emoji-Free)
// 45 rich, culturally resonant, modern passions spanning 7 distinct categories
// ============================================================================

const FALLBACK_INTERESTS: InterestItem[] = [
  // Food & Drink
  { id: 'int_1', name: 'Filter Coffee', slug: 'filter-coffee', category: 'Food & Drink' },
  { id: 'int_2', name: 'Artisan Cocktails', slug: 'artisan-cocktails', category: 'Food & Drink' },
  { id: 'int_3', name: 'Street Food & Chaat', slug: 'street-food', category: 'Food & Drink' },
  { id: 'int_4', name: 'Home Cooking & Spices', slug: 'home-cooking', category: 'Food & Drink' },
  { id: 'int_5', name: 'Wine Tasting', slug: 'wine-tasting', category: 'Food & Drink' },
  { id: 'int_6', name: 'Specialty Tea & Matcha', slug: 'specialty-tea', category: 'Food & Drink' },
  { id: 'int_7', name: 'Baking & Sourdough', slug: 'baking', category: 'Food & Drink' },

  // Music & Sound
  {
    id: 'int_8',
    name: 'Hindustani Classical',
    slug: 'hindustani-classical',
    category: 'Music & Sound',
  },
  { id: 'int_9', name: 'Live Indie Gigs', slug: 'live-gigs', category: 'Music & Sound' },
  { id: 'int_10', name: 'Sufi & Ghazals', slug: 'sufi-ghazals', category: 'Music & Sound' },
  { id: 'int_11', name: 'Vinyl Records', slug: 'vinyl-records', category: 'Music & Sound' },
  {
    id: 'int_12',
    name: 'Electronic & Techno',
    slug: 'electronic-techno',
    category: 'Music & Sound',
  },
  { id: 'int_13', name: 'Jazz & Blues', slug: 'jazz-blues', category: 'Music & Sound' },
  { id: 'int_14', name: 'Podcasts & Deep Dives', slug: 'podcasts', category: 'Music & Sound' },

  // Arts & Culture
  { id: 'int_15', name: 'Indie Cinema', slug: 'indie-cinema', category: 'Arts & Culture' },
  { id: 'int_16', name: 'Modern Indian Art', slug: 'modern-art', category: 'Arts & Culture' },
  {
    id: 'int_17',
    name: 'Architecture & Heritage',
    slug: 'architecture',
    category: 'Arts & Culture',
  },
  { id: 'int_18', name: 'Poetry & Shayari', slug: 'poetry-shayari', category: 'Arts & Culture' },
  { id: 'int_19', name: 'Film Photography', slug: 'film-photography', category: 'Arts & Culture' },
  {
    id: 'int_20',
    name: 'Museums & Galleries',
    slug: 'museums-galleries',
    category: 'Arts & Culture',
  },
  { id: 'int_21', name: 'Theater & Performing Arts', slug: 'theater', category: 'Arts & Culture' },

  // Active & Outdoors
  {
    id: 'int_22',
    name: 'Weekend Trekking',
    slug: 'weekend-trekking',
    category: 'Active & Outdoors',
  },
  { id: 'int_23', name: 'Heritage Walks', slug: 'heritage-walks', category: 'Active & Outdoors' },
  { id: 'int_24', name: 'Running & Marathons', slug: 'running', category: 'Active & Outdoors' },
  {
    id: 'int_25',
    name: 'Yoga & Mindfulness',
    slug: 'yoga-mindfulness',
    category: 'Active & Outdoors',
  },
  { id: 'int_26', name: 'Cycling & Gravel', slug: 'cycling', category: 'Active & Outdoors' },
  { id: 'int_27', name: 'Scuba & Surfing', slug: 'scuba-surfing', category: 'Active & Outdoors' },
  { id: 'int_28', name: 'Rock Climbing', slug: 'rock-climbing', category: 'Active & Outdoors' },

  // Lifestyle & Leisure
  {
    id: 'int_29',
    name: 'Books & Literature',
    slug: 'books-literature',
    category: 'Lifestyle & Leisure',
  },
  {
    id: 'int_30',
    name: 'Board Games & Catan',
    slug: 'board-games',
    category: 'Lifestyle & Leisure',
  },
  { id: 'int_31', name: 'Dog & Pet Lover', slug: 'pet-lover', category: 'Lifestyle & Leisure' },
  { id: 'int_32', name: 'Solo Traveling', slug: 'solo-traveling', category: 'Lifestyle & Leisure' },
  {
    id: 'int_33',
    name: 'Astronomy & Stargazing',
    slug: 'astronomy',
    category: 'Lifestyle & Leisure',
  },
  {
    id: 'int_34',
    name: 'Vintage Thrifting',
    slug: 'vintage-thrifting',
    category: 'Lifestyle & Leisure',
  },

  // Sports & Fitness
  { id: 'int_35', name: 'Cricket & IPL', slug: 'cricket', category: 'Sports & Fitness' },
  { id: 'int_36', name: 'Formula 1', slug: 'formula-1', category: 'Sports & Fitness' },
  {
    id: 'int_37',
    name: 'Football & Premier League',
    slug: 'football',
    category: 'Sports & Fitness',
  },
  { id: 'int_38', name: 'Tennis & Padel', slug: 'tennis-padel', category: 'Sports & Fitness' },
  { id: 'int_39', name: 'Chess & Strategy', slug: 'chess', category: 'Sports & Fitness' },
  {
    id: 'int_40',
    name: 'Gym & Calisthenics',
    slug: 'gym-calisthenics',
    category: 'Sports & Fitness',
  },

  // Tech & Creative
  { id: 'int_41', name: 'Creative Coding', slug: 'creative-coding', category: 'Tech & Creative' },
  {
    id: 'int_42',
    name: 'Design & Typography',
    slug: 'design-typography',
    category: 'Tech & Creative',
  },
  { id: 'int_43', name: 'Pottery & Ceramics', slug: 'pottery', category: 'Tech & Creative' },
  { id: 'int_44', name: 'AI & Futurism', slug: 'ai-futurism', category: 'Tech & Creative' },
  {
    id: 'int_45',
    name: 'Mechanical Keyboards',
    slug: 'mechanical-keyboards',
    category: 'Tech & Creative',
  },
];

// ============================================================================
// Semantic Icon Resolver
// Maps passion keywords and slugs to dedicated vector icons
// ============================================================================

const getInterestIcon = (item: {
  slug?: string;
  name: string;
  category?: string;
}): React.FC<any> => {
  const key = `${item.slug || ''} ${item.name.toLowerCase()} ${item.category?.toLowerCase() || ''}`;

  if (
    key.includes('coffee') ||
    key.includes('tea') ||
    key.includes('matcha') ||
    key.includes('chai')
  )
    return Coffee;
  if (
    key.includes('wine') ||
    key.includes('cocktail') ||
    key.includes('bar') ||
    key.includes('brew')
  )
    return Wine;
  if (
    key.includes('cinema') ||
    key.includes('film') ||
    key.includes('movie') ||
    key.includes('theater')
  )
    return Film;
  if (
    key.includes('food') ||
    key.includes('cook') ||
    key.includes('chaat') ||
    key.includes('baking') ||
    key.includes('bake')
  )
    return UtensilsCrossed;
  if (
    key.includes('trek') ||
    key.includes('hike') ||
    key.includes('mountain') ||
    key.includes('climbing') ||
    key.includes('camp')
  )
    return Mountain;
  if (key.includes('photo') || key.includes('camera')) return Camera;
  if (
    key.includes('art') ||
    key.includes('paint') ||
    key.includes('pottery') ||
    key.includes('ceramics') ||
    key.includes('gallery')
  )
    return Palette;
  if (
    key.includes('architecture') ||
    key.includes('heritage') ||
    key.includes('museum') ||
    key.includes('history')
  )
    return Landmark;
  if (key.includes('book') || key.includes('literature') || key.includes('read')) return BookOpen;
  if (
    key.includes('cricket') ||
    key.includes('football') ||
    key.includes('formula') ||
    key.includes('tennis') ||
    key.includes('chess') ||
    key.includes('ipl')
  )
    return Trophy;
  if (
    key.includes('gym') ||
    key.includes('calisthenics') ||
    key.includes('fitness') ||
    key.includes('workout')
  )
    return Dumbbell;
  if (
    key.includes('run') ||
    key.includes('marathon') ||
    key.includes('cycling') ||
    key.includes('scuba') ||
    key.includes('surfing')
  )
    return Activity;
  if (
    key.includes('board') ||
    key.includes('catan') ||
    key.includes('gaming') ||
    key.includes('game')
  )
    return Gamepad2;
  if (key.includes('walk') || key.includes('stroll')) return Footprints;
  if (
    key.includes('yoga') ||
    key.includes('mindful') ||
    key.includes('meditation') ||
    key.includes('wellness')
  )
    return Sun;
  if (
    key.includes('classical') ||
    key.includes('sufi') ||
    key.includes('ghazal') ||
    key.includes('vinyl') ||
    key.includes('techno') ||
    key.includes('jazz') ||
    key.includes('music')
  )
    return Music;
  if (
    key.includes('gig') ||
    key.includes('live') ||
    key.includes('concert') ||
    key.includes('podcast')
  )
    return Headphones;
  if (key.includes('poetry') || key.includes('shayari') || key.includes('write')) return PenTool;
  if (key.includes('travel') || key.includes('solo') || key.includes('trip')) return Plane;
  if (key.includes('pet') || key.includes('dog') || key.includes('cat') || key.includes('animal'))
    return Heart;
  if (
    key.includes('code') ||
    key.includes('coding') ||
    key.includes('software') ||
    key.includes('dev')
  )
    return Code;
  if (key.includes('ai') || key.includes('futurism') || key.includes('keyboard')) return Cpu;
  if (key.includes('design') || key.includes('typography')) return Feather;
  if (key.includes('star') || key.includes('astronomy') || key.includes('sky')) return Sparkles;

  // Fallbacks by category
  if (item.category?.toLowerCase().includes('food')) return UtensilsCrossed;
  if (item.category?.toLowerCase().includes('music')) return Music;
  if (item.category?.toLowerCase().includes('art')) return Palette;
  if (
    item.category?.toLowerCase().includes('outdoor') ||
    item.category?.toLowerCase().includes('active')
  )
    return Mountain;
  if (
    item.category?.toLowerCase().includes('sport') ||
    item.category?.toLowerCase().includes('fitness')
  )
    return Trophy;
  if (
    item.category?.toLowerCase().includes('tech') ||
    item.category?.toLowerCase().includes('creative')
  )
    return Code;
  if (
    item.category?.toLowerCase().includes('lifestyle') ||
    item.category?.toLowerCase().includes('leisure')
  )
    return BookOpen;

  return Sparkles;
};

// Category Icon Mapping for Cards and Modal
const getCategoryIcon = (category: string): React.FC<any> => {
  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('drink')) return UtensilsCrossed;
  if (cat.includes('music') || cat.includes('sound')) return Headphones;
  if (cat.includes('art') || cat.includes('culture')) return Palette;
  if (cat.includes('outdoor') || cat.includes('active')) return Mountain;
  if (cat.includes('lifestyle') || cat.includes('leisure')) return BookOpen;
  if (cat.includes('sport') || cat.includes('fitness')) return Trophy;
  if (cat.includes('tech') || cat.includes('creative')) return Code;
  return Sparkles;
};

// ============================================================================
// Main Screen Component
// ============================================================================

export default function OnboardingInterestsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  // Scroll listener for glossy top vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  const { draftInterests, toggleDraftInterest, setDraftInterests } = useOnboardingStore();

  const [availableInterests, setAvailableInterests] = useState<InterestItem[]>(FALLBACK_INTERESTS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null);
  const [categorySearchText, setCategorySearchText] = useState('');

  // Ensure no passions are selected by default on initial entry
  useEffect(() => {
    if (draftInterests.length < 3 && draftInterests.length > 0) {
      setDraftInterests([]);
    }
  }, []);

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

  // Sanitized taxonomy: guarantees zero emojis anywhere in UI
  const sanitizedTaxonomy = useMemo(() => {
    return availableInterests.map((item) => ({
      ...item,
      name: cleanInterestName(item.name),
    }));
  }, [availableInterests]);

  // Distinct category list for cards
  const categoryCards = useMemo(() => {
    return Array.from(new Set(sanitizedTaxonomy.map((item) => item.category || 'General')));
  }, [sanitizedTaxonomy]);

  // Passions for the actively opened category modal
  const modalCategoryItems = useMemo(() => {
    if (!selectedCategoryModal) return [];
    return sanitizedTaxonomy.filter(
      (item) => (item.category || 'General') === selectedCategoryModal
    );
  }, [sanitizedTaxonomy, selectedCategoryModal]);

  const modalCategorySelectedCount = useMemo(() => {
    return modalCategoryItems.filter((item) => draftInterests.includes(item.id)).length;
  }, [modalCategoryItems, draftInterests]);

  // Filtered passions inside the modal when searching in-category
  const filteredModalCategoryItems = useMemo(() => {
    const trimmed = categorySearchText.trim().toLowerCase();
    if (!trimmed) return modalCategoryItems;
    return modalCategoryItems.filter((item) => item.name.toLowerCase().includes(trimmed));
  }, [modalCategoryItems, categorySearchText]);

  // Filtered interests when actively typing in the search bar
  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return sanitizedTaxonomy.filter((item) => {
      return (
        item.name.toLowerCase().includes(trimmed) ||
        (item.slug && item.slug.toLowerCase().includes(trimmed)) ||
        (item.category && item.category.toLowerCase().includes(trimmed))
      );
    });
  }, [sanitizedTaxonomy, searchQuery]);

  // Check if current search query exactly matches an existing passion
  const hasExactSearchMatch = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return false;
    return sanitizedTaxonomy.some((item) => item.name.toLowerCase() === trimmed);
  }, [sanitizedTaxonomy, searchQuery]);

  // Map of category to selected count (for visual category badges)
  const categorySelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of sanitizedTaxonomy) {
      if (draftInterests.includes(item.id)) {
        const cat = item.category || 'General';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [sanitizedTaxonomy, draftInterests]);

  const handleToggle = (id: string) => {
    const isSelected = draftInterests.includes(id);
    if (!isSelected && draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 passions.');
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

  // Add custom passion searched by user (No restrictions, fully flexible)
  const handleAddCustomPassion = (rawName: string) => {
    const cleaned = cleanInterestName(rawName).trim();
    if (!cleaned) return;

    if (draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 passions.');
      return;
    }

    // Check if it already exists in taxonomy
    const existing = sanitizedTaxonomy.find((i) => i.name.toLowerCase() === cleaned.toLowerCase());

    if (existing) {
      if (!draftInterests.includes(existing.id)) {
        haptics.selection();
        toggleDraftInterest(existing.id);
      }
    } else {
      const customId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const customSlug = cleaned
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const customItem: InterestItem = {
        id: customId,
        name: cleaned,
        slug: customSlug,
        category: 'Custom & Personal',
      };
      setAvailableInterests((prev) => [customItem, ...prev]);
      toggleDraftInterest(customId);
      haptics.notificationSuccess();
    }

    setSearchQuery('');
    if (errorMessage) setErrorMessage(undefined);
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/photos');
    }
  };

  const handleNext = async () => {
    if (draftInterests.length < 3) {
      haptics.notificationError();
      setErrorMessage('Please select at least 3 passions that represent you.');
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

  const isMinimumMet = draftInterests.length >= 3;
  const count = draftInterests.length;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Specular Frosted Top Vignette (Fades in dynamically on scroll) */}
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

      {/* Floating Circular Back Button on top left */}
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
        <ArrowLeft size={19} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth || 540,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 60, 72),
            paddingBottom: Math.max(insets.bottom + 130, 150),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ======================================================== */}
        {/* Header Section (with clean unboxed 03 / 06 step counter) */}
        {/* ======================================================== */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              What are you into?
            </Heading>

            {/* Clean unboxed 03 / 06 step counter */}
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
            Select 3 to 10 passions to help us curate profiles who share your rhythm and creative
            soul.
          </Text>
        </View>

        {/* Error Notification Banner */}
        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FCA5A5',
              },
            ]}
          >
            <AlertCircle size={15} color="#EF4444" style={{ marginRight: 8, marginTop: 1 }} />
            <Text level="bodySmall" style={styles.errorBannerText}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* ======================================================== */}
        {/* Compact, Non-Boxy Curation & Rhythm Progress Bar */}
        {/* ======================================================== */}
        <View style={styles.compactRhythmSection}>
          <View style={styles.compactRhythmHeader}>
            <View style={styles.compactRhythmStatusCluster}>
              <View
                style={[
                  styles.statusIndicatorDot,
                  {
                    backgroundColor: isMinimumMet ? '#10B981' : theme.colors.textTertiary,
                  },
                ]}
              />
              <Text style={[styles.compactRhythmStatusText, { color: theme.colors.textSecondary }]}>
                {count === 0
                  ? 'Select at least 3 passions to continue'
                  : count < 3
                    ? `${3 - count} more needed for minimum`
                    : count === 10
                      ? 'Maximum 10 passions selected'
                      : `Minimum reached • ${10 - count} optional open`}
              </Text>
            </View>

            <Text
              style={[
                styles.compactRhythmCountText,
                {
                  color: isMinimumMet ? theme.colors.textPrimary : theme.colors.textTertiary,
                  fontFamily: folkraFont,
                },
              ]}
            >
              {count}/10
            </Text>
          </View>

          {/* 10-Segment Progress Rail */}
          <View style={styles.compactSegmentRail}>
            {Array.from({ length: 10 }).map((_, idx) => {
              const isFilled = idx < count;
              const isMandatory = idx < 3;
              return (
                <View
                  key={`rail-tick-${idx}`}
                  style={[
                    styles.compactSegmentTick,
                    {
                      backgroundColor: isFilled
                        ? isDark
                          ? '#FFFFFF'
                          : '#121216'
                        : isMandatory
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.16)'
                            : '#DCDCE0'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : '#ECECF0',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* ======================================================== */}
        {/* Search Input Bar (Fully Functional for Searching & Custom Passions) */}
        {/* ======================================================== */}
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search or type any passion..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (errorMessage) setErrorMessage(undefined);
            }}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim().length > 0 && !hasExactSearchMatch) {
                handleAddCustomPassion(searchQuery.trim());
              }
            }}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search input"
            >
              <X size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* If user types something that isn't already an exact match, offer instant Custom Passion creation */}
        {searchQuery.trim().length > 0 && !hasExactSearchMatch && (
          <TouchableOpacity
            onPress={() => handleAddCustomPassion(searchQuery.trim())}
            style={[
              styles.customPassionActionCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`Add ${searchQuery.trim()} as custom passion`}
          >
            <View
              style={[
                styles.customPassionIconBadge,
                { backgroundColor: isDark ? '#FFFFFF' : '#121216' },
              ]}
            >
              <Plus size={13} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={[styles.customPassionActionTitle, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
                Add "{cleanInterestName(searchQuery.trim())}"
              </Text>
              <Text style={[styles.customPassionActionSub, { color: theme.colors.textTertiary }]}>
                Tap to include as your custom passion
              </Text>
            </View>
            <View
              style={[
                styles.customPassionAddPill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text style={[styles.customPassionAddPillText, { color: theme.colors.textPrimary }]}>
                Add
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ======================================================== */}
        {/* Category Cards Grid (Rounded Squared Cards) OR Search Results */}
        {/* ======================================================== */}
        {searchQuery.trim() !== '' ? (
          /* Active Search View */
          searchResults.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View
                style={[
                  styles.emptyStateIconCircle,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                ]}
              >
                <Search size={20} color={theme.colors.textTertiary} />
              </View>
              <Text
                style={[
                  styles.emptyStateTitle,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                NO CATALOG RESULTS
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textSecondary }]}>
                {`No existing passion in our catalog matches "${searchQuery.trim()}". You can tap "Add" above to make it your own custom passion!`}
              </Text>
            </View>
          ) : (
            <View style={styles.searchSectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={[
                    styles.sectionHeading,
                    { color: theme.colors.textSecondary, fontFamily: folkraFont },
                  ]}
                >
                  SEARCH RESULTS
                </Text>
                <Text style={[styles.sectionCountHint, { color: theme.colors.textTertiary }]}>
                  {searchResults.length} matches
                </Text>
              </View>

              <View style={styles.chipGrid}>
                {searchResults.map((item) => {
                  const isSelected = draftInterests.includes(item.id);
                  const PassionIcon = getInterestIcon(item);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleToggle(item.id)}
                      style={[
                        styles.passionCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? '#121216'
                              : '#FFFFFF',
                          borderColor: isSelected
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                        },
                      ]}
                      activeOpacity={0.82}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'unselected'}`}
                    >
                      <View
                        style={[
                          styles.passionIconCircle,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? '#0B0B0E'
                                : '#FFFFFF'
                              : isDark
                                ? 'rgba(255, 255, 255, 0.06)'
                                : '#F4F4F6',
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Check
                            size={12}
                            color={isDark ? '#FFFFFF' : '#0B0B0E'}
                            strokeWidth={2.8}
                          />
                        ) : (
                          <PassionIcon size={12.5} color={theme.colors.textSecondary} />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.passionCardTitle,
                          {
                            color: isSelected
                              ? isDark
                                ? '#0B0B0E'
                                : '#FFFFFF'
                              : theme.colors.textPrimary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )
        ) : (
          /* Default Category Cards View (Rounded Squared Cards with Icon in Middle & Text in Bottom) */
          <View style={styles.categorySectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionHeading,
                  { color: theme.colors.textSecondary, fontFamily: folkraFont },
                ]}
              >
                CATEGORIES
              </Text>
              <Text style={[styles.sectionCountHint, { color: theme.colors.textTertiary }]}>
                Tap to explore & select
              </Text>
            </View>

            <View style={styles.categoryGrid}>
              {categoryCards.map((category) => {
                const CatIcon = getCategoryIcon(category);
                const categoryItems = sanitizedTaxonomy.filter(
                  (i) => (i.category || 'General') === category
                );
                const selectedCount = categorySelectedCounts[category] || 0;
                const hasSelections = selectedCount > 0;

                return (
                  <TouchableOpacity
                    key={`cat-card-${category}`}
                    onPress={() => {
                      haptics.impactLight();
                      setSelectedCategoryModal(category);
                    }}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isDark
                          ? hasSelections
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(255, 255, 255, 0.035)'
                          : hasSelections
                            ? '#FFFFFF'
                            : '#FFFFFF',
                        borderColor: hasSelections
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.35)'
                            : '#121216'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#E4E4E7',
                      },
                    ]}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={`${category}, ${hasSelections ? `${selectedCount} selected` : `${categoryItems.length} passions`}`}
                  >
                    {/* Top-Right Badge showing count selected */}
                    {hasSelections && (
                      <View
                        style={[
                          styles.categoryCardTopBadge,
                          {
                            backgroundColor: isDark ? '#FFFFFF' : '#121216',
                          },
                        ]}
                      >
                        <Check size={9.5} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                        <Text
                          style={[
                            styles.categoryCardTopBadgeText,
                            { color: isDark ? '#000000' : '#FFFFFF' },
                          ]}
                        >
                          {selectedCount}
                        </Text>
                      </View>
                    )}

                    {/* Icon in the Middle */}
                    <View
                      style={[
                        styles.categoryCardIconCircle,
                        {
                          backgroundColor: isDark
                            ? hasSelections
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(255, 255, 255, 0.06)'
                            : hasSelections
                              ? 'rgba(0, 0, 0, 0.06)'
                              : '#F4F4F6',
                        },
                      ]}
                    >
                      <CatIcon
                        size={28}
                        color={
                          hasSelections
                            ? isDark
                              ? '#FFFFFF'
                              : '#000000'
                            : isDark
                              ? '#E4E4E7'
                              : '#27272A'
                        }
                        strokeWidth={1.9}
                      />
                    </View>

                    {/* Text in the Bottom */}
                    <View style={styles.categoryCardBottomWrap}>
                      <Text
                        style={[
                          styles.categoryCardTitle,
                          {
                            color: theme.colors.textPrimary,
                            fontFamily: folkraFont,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {category}
                      </Text>
                      <Text
                        style={[
                          styles.categoryCardSubtitle,
                          {
                            color: theme.colors.textTertiary,
                            fontWeight: '500',
                          },
                        ]}
                      >
                        {`${categoryItems.length} passions`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
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
          {/* Professional CTA Button (Solid, Non-See-Through Button) */}
          <TouchableOpacity
            onPress={handleNext}
            disabled={isLoading}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: isMinimumMet
                  ? isDark
                    ? '#FFFFFF'
                    : '#121216'
                  : isDark
                    ? '#222228'
                    : '#E4E4E7',
                borderColor: isMinimumMet
                  ? isDark
                    ? 'transparent'
                    : 'rgba(0, 0, 0, 0.12)'
                  : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.08)',
                borderWidth: isMinimumMet ? (isDark ? 0 : 1) : 1,
                shadowColor: '#000000',
                shadowOpacity: isMinimumMet ? (isDark ? 0.28 : 0.12) : 0.06,
                opacity: isLoading ? 0.75 : 1,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isMinimumMet
                ? `Continue to prompts (${count} selected)`
                : count === 0
                  ? 'Select at least 3 passions to continue (0 of 3 selected)'
                  : `Select at least 3 passions (${count} of 3 required)`
            }
            testID="interests-continue-button"
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={
                  isMinimumMet ? (isDark ? '#000000' : '#FFFFFF') : isDark ? '#A1A1AA' : '#71717A'
                }
              />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: isMinimumMet
                        ? isDark
                          ? '#000000'
                          : '#FFFFFF'
                        : isDark
                          ? '#8E8E93'
                          : '#71717A',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  {count < 3
                    ? count === 0
                      ? 'SELECT AT LEAST 3 PASSIONS (0/3)'
                      : `SELECT ${3 - count} MORE PASSION${3 - count > 1 ? 'S' : ''} (${count}/3)`
                    : `CONTINUE (${count} SELECTED)`}
                </Text>
                {isMinimumMet && (
                  <ArrowRight
                    size={17}
                    color={isDark ? '#000000' : '#FFFFFF'}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            You can refine or add more passions anytime in your profile settings.
          </Text>
        </View>
      </View>

      {/* ======================================================== */}
      {/* Category Passions Bottom Sheet Modal (Basics Page Style)  */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={!!selectedCategoryModal}
        onClose={() => {
          setSelectedCategoryModal(null);
          setCategorySearchText('');
        }}
        sheetStyle={{ maxHeight: '86%' }}
        showHandle={true}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              {selectedCategoryModal || ''}
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              {modalCategorySelectedCount > 0
                ? `${modalCategorySelectedCount} selected • ${modalCategoryItems.length} curated passions`
                : `${modalCategoryItems.length} curated passions • select what resonates with you`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setSelectedCategoryModal(null);
              setCategorySearchText('');
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close category modal"
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar Facility */}
        <View
          style={[
            styles.modalSearchContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder={`Search in ${selectedCategoryModal || 'category'}...`}
            placeholderTextColor={theme.colors.textTertiary}
            value={categorySearchText}
            onChangeText={setCategorySearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {categorySearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setCategorySearchText('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Passions Scroll Area */}
        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalChipsGrid}>
            {filteredModalCategoryItems.map((item) => {
              const isSelected = draftInterests.includes(item.id);
              const PassionIcon = getInterestIcon(item);

              return (
                <TouchableOpacity
                  key={`modal-${item.id}`}
                  onPress={() => handleToggle(item.id)}
                  style={[
                    styles.passionCard,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#121216'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : '#F4F4F6',
                      borderColor: isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#121216'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.09)'
                          : '#E4E4E7',
                    },
                  ]}
                  activeOpacity={0.82}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'unselected'}`}
                >
                  <View
                    style={[
                      styles.passionIconCircle,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#0B0B0E'
                            : '#FFFFFF'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : '#FFFFFF',
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Check size={12} color={isDark ? '#FFFFFF' : '#0B0B0E'} strokeWidth={2.8} />
                    ) : (
                      <PassionIcon size={12.5} color={theme.colors.textSecondary} />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.passionCardTitle,
                      {
                        color: isSelected
                          ? isDark
                            ? '#0B0B0E'
                            : '#FFFFFF'
                          : theme.colors.textPrimary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Confirm / Done Button */}
        <TouchableOpacity
          style={[
            styles.confirmCustomButton,
            {
              backgroundColor: theme.colors.textPrimary,
              marginTop: 14,
              marginBottom: 4,
            },
          ]}
          onPress={() => {
            haptics.notificationSuccess();
            setSelectedCategoryModal(null);
            setCategorySearchText('');
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Done selecting passions in this category"
        >
          <Text
            style={{
              color: isDark ? '#000000' : '#FFFFFF',
              fontWeight: '700',
              fontSize: 14.5,
              fontFamily: folkraFont,
            }}
          >
            {modalCategorySelectedCount > 0
              ? `Done (${modalCategorySelectedCount} Selected)`
              : 'Done'}
          </Text>
        </TouchableOpacity>
      </SmoothBottomSheetModal>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

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
  },
  header: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.6,
    flex: 1,
  },
  // Clean unboxed 03 / 06 step counter
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 12,
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
    fontSize: 14.5,
    lineHeight: 21,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  // Compact, Non-Boxy Curation & Rhythm Progress Bar
  compactRhythmSection: {
    marginBottom: 14,
  },
  compactRhythmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compactRhythmStatusCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusIndicatorDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    marginRight: 7,
  },
  compactRhythmStatusText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  compactRhythmCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactSegmentRail: {
    flexDirection: 'row',
    gap: 3.5,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactSegmentTick: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  // Search Results Wrap & Section Header
  searchSectionWrap: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCountHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Search Bar Styles
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  // Custom Passion Action Card
  customPassionActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  customPassionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customPassionActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  customPassionActionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  customPassionAddPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  customPassionAddPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  // Category Cards Section & Grid (Rounded Squared Cards)
  categorySectionContainer: {
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  categoryCard: {
    width: '48%',
    aspectRatio: 1.05,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryCardTopBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  categoryCardTopBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  categoryCardIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  categoryCardBottomWrap: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 2,
  },
  categoryCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 2.5,
  },
  categoryCardSubtitle: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyStateIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal Sheet Styles (Matching Basics Page)
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  modalScrollContent: {
    paddingVertical: 4,
  },
  modalChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  confirmCustomButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Multi-option fluid side-by-side chip grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'center',
  },
  passionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 7,
    paddingRight: 11,
    paddingVertical: 6,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  passionIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  passionCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  // Floating Bottom Dock with Feathered Fade (Matching photos.tsx)
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
    letterSpacing: 0.4,
  },
  dockFootnoteText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
