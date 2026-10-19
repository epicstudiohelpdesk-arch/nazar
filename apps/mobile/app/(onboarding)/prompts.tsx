import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Check,
  Plus,
  Sparkles,
  Coffee,
  Heart,
  Flame,
  Smile,
  Compass,
  Trash2,
  RotateCw,
  AlertCircle,
  BookOpen,
  type LucideIcon,
} from 'lucide-react-native';
import type { PromptDefinitionItem, PromptAnswerInput } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { SmoothBottomSheetModal } from '../../src/design/components/modal/SmoothBottomSheetModal.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import {
  useOnboardingStore,
  type DraftPromptItem,
  type DraftProfile,
  type DraftPhotoItem,
} from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

// ============================================================================
// Curated Authentic Prompt Definitions (Categorized)
// ============================================================================

export const FALLBACK_PROMPT_DEFINITIONS: PromptDefinitionItem[] = [
  // Lifestyle & Daily Rhythm
  {
    id: 'p_def_1',
    prompt: 'My ideal Sunday morning looks like...',
    category: 'Lifestyle',
    sortOrder: 1,
  },
  {
    id: 'p_def_2',
    prompt: 'The soundtrack to my everyday life is...',
    category: 'Lifestyle',
    sortOrder: 2,
  },
  {
    id: 'p_def_3',
    prompt: 'My simple, non-negotiable daily ritual is...',
    category: 'Lifestyle',
    sortOrder: 3,
  },
  {
    id: 'p_def_4',
    prompt: 'A life goal of mine is...',
    category: 'Lifestyle',
    sortOrder: 4,
  },
  // Dates & Chemistry
  {
    id: 'p_def_5',
    prompt: 'Together, we could finally...',
    category: 'Dates',
    sortOrder: 5,
  },
  {
    id: 'p_def_6',
    prompt: 'The quickest way to my heart is...',
    category: 'Dates',
    sortOrder: 6,
  },
  {
    id: 'p_def_7',
    prompt: 'First date green flag that immediately wins me over...',
    category: 'Dates',
    sortOrder: 7,
  },
  {
    id: 'p_def_8',
    prompt: 'I am looking for someone who...',
    category: 'Dates',
    sortOrder: 8,
  },
  // Food & Coffee
  {
    id: 'p_def_9',
    prompt: 'The best chai / coffee spot in my city is...',
    category: 'Food & Drink',
    sortOrder: 9,
  },
  {
    id: 'p_def_10',
    prompt: 'My signature dish that never fails...',
    category: 'Food & Drink',
    sortOrder: 10,
  },
  {
    id: 'p_def_11',
    prompt: 'Unpopular food opinion I will defend to the death...',
    category: 'Food & Drink',
    sortOrder: 11,
  },
  // Humor & Wit
  {
    id: 'p_def_12',
    prompt: 'The quickest way to make me laugh is...',
    category: 'Humor',
    sortOrder: 12,
  },
  {
    id: 'p_def_13',
    prompt: 'A shower thought I recently had...',
    category: 'Humor',
    sortOrder: 13,
  },
  {
    id: 'p_def_14',
    prompt: 'Two truths and a lie...',
    category: 'Humor',
    sortOrder: 14,
  },
  // Passions & Obsessions
  {
    id: 'p_def_15',
    prompt: 'I geek out endlessly on...',
    category: 'Passions',
    sortOrder: 15,
  },
  {
    id: 'p_def_16',
    prompt: 'A topic I could give an impromptu 40-minute lecture on...',
    category: 'Passions',
    sortOrder: 16,
  },
  {
    id: 'p_def_17',
    prompt: 'My latest hyperfixation or obsession...',
    category: 'Passions',
    sortOrder: 17,
  },
  // Values & Deep Thoughts
  {
    id: 'p_def_18',
    prompt: 'A non-negotiable for me in a relationship is...',
    category: 'Values',
    sortOrder: 18,
  },
  {
    id: 'p_def_19',
    prompt: 'The most important thing I have learned about love...',
    category: 'Values',
    sortOrder: 19,
  },
  {
    id: 'p_def_20',
    prompt: 'Something that took me years to truly unlearn...',
    category: 'Values',
    sortOrder: 20,
  },
];

const normalizeCategoryName = (category?: string): string => {
  if (!category) return 'Lifestyle';
  const c = category.toUpperCase().trim();
  if (c === 'GETTING_TO_KNOW' || c === 'GETTING TO KNOW') return 'Lifestyle';
  if (c === 'DATING' || c === 'DATES') return 'Dates';
  if (c === 'HUMOR' || c === 'WIT') return 'Humor';
  if (c === 'LIFESTYLE') return 'Lifestyle';
  if (c === 'FOOD_AND_DRINK' || c === 'FOOD & DRINK') return 'Food & Drink';
  if (c === 'PASSIONS') return 'Passions';
  if (c === 'VALUES') return 'Values';
  return category;
};

const getPromptCategoryIcon = (category?: string): LucideIcon => {
  const cat = (category || '').toLowerCase();
  if (
    cat.includes('food') ||
    cat.includes('drink') ||
    cat.includes('coffee') ||
    cat.includes('chai')
  ) {
    return Coffee;
  }
  if (cat.includes('date') || cat.includes('love') || cat.includes('heart')) {
    return Heart;
  }
  if (cat.includes('humor') || cat.includes('laugh') || cat.includes('joke')) {
    return Smile;
  }
  if (cat.includes('passion') || cat.includes('geek')) {
    return Flame;
  }
  if (cat.includes('value') || cat.includes('ritual') || cat.includes('truth')) {
    return Compass;
  }
  if (cat.includes('book') || cat.includes('story')) {
    return BookOpen;
  }
  return Sparkles;
};

interface ActivePromptSlot {
  promptDefinitionId: string;
  prompt: string;
  category: string;
  answer: string;
}

/**
 * Intelligently recommends the best initial personality prompt based on the user's
 * chosen passions, relationship intent, bio, and occupation.
 */
export function selectSmartDefaultPrompt(
  draftInterests: string[] = [],
  draftProfile?: DraftProfile,
  _draftPhotos?: DraftPhotoItem[],
  taxonomy: PromptDefinitionItem[] = FALLBACK_PROMPT_DEFINITIONS
): PromptDefinitionItem {
  if (!taxonomy || taxonomy.length === 0) {
    return FALLBACK_PROMPT_DEFINITIONS[0]!;
  }

  // Helper for accurate keyword matching with word boundaries on short tokens
  const matchesAnyKeyword = (text: string, keywords: string[]): boolean => {
    return keywords.some((kw) => {
      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(text);
      }
      return text.includes(kw);
    });
  };

  // 1. Analyze Passions / Interests
  const interestsText = draftInterests.join(' ').toLowerCase();

  // Food & Drink / Cooking / Cafes / Street food
  const hasFoodInterest = matchesAnyKeyword(interestsText, [
    'chai',
    'coffee',
    'tea',
    'food',
    'cook',
    'bake',
    'baking',
    'biryani',
    'dosa',
    'street food',
    'chaat',
    'wine',
    'beer',
    'cafe',
    'dining',
    'ramen',
    'pizza',
    'sushi',
  ]);

  // Music & Audio
  const hasMusicInterest = matchesAnyKeyword(interestsText, [
    'music',
    'indie',
    'techno',
    'hip-hop',
    'hip hop',
    'concert',
    'vinyl',
    'guitar',
    'rock',
    'electronic',
    'soundtrack',
    'spotify',
    'jazz',
    'gig',
  ]);

  // Geek / Tech / Anime / Gaming / Books / Cinema
  const hasGeekOrTechInterest = matchesAnyKeyword(interestsText, [
    'tech',
    'code',
    'coding',
    'anime',
    'manga',
    'gaming',
    'sci-fi',
    'fantasy',
    'book',
    'reading',
    'crypto',
    'physics',
    'ai',
    'artificial intelligence',
    'cinema',
    'film',
  ]);

  // Humor / Comedy / Memes
  const hasHumorInterest = matchesAnyKeyword(interestsText, [
    'comedy',
    'standup',
    'stand-up',
    'meme',
    'sarcasm',
    'improv',
    'joke',
  ]);

  // Travel / Adventure / Outdoors / Fitness / Sports
  const hasOutdoorsInterest = matchesAnyKeyword(interestsText, [
    'travel',
    'trek',
    'hike',
    'hiking',
    'mountain',
    'beach',
    'climb',
    'gym',
    'fitness',
    'yoga',
    'run',
    'running',
    'cycling',
    'sports',
    'football',
    'cricket',
  ]);

  // 2. Analyze Profile Intent, Bio, Occupation
  const intent = draftProfile?.intent;
  const bio = (draftProfile?.bio || '').toLowerCase();
  const occupation = (draftProfile?.occupation || '').toLowerCase();

  // If user has strong food passions
  if (hasFoodInterest) {
    if (
      interestsText.includes('cook') ||
      interestsText.includes('bake') ||
      interestsText.includes('dish')
    ) {
      const match = taxonomy.find((t) => t.id === 'p_def_10');
      if (match) return match;
    }
    const match = taxonomy.find((t) => t.id === 'p_def_9');
    if (match) return match;
  }

  // If user has strong geek/intellectual/tech passions or tech occupation
  if (
    hasGeekOrTechInterest ||
    occupation.includes('engineer') ||
    occupation.includes('dev') ||
    occupation.includes('tech')
  ) {
    const match = taxonomy.find((t) => t.id === 'p_def_15');
    if (match) return match;
    const matchAlt = taxonomy.find((t) => t.id === 'p_def_16');
    if (matchAlt) return matchAlt;
  }

  // If user has music passions
  if (hasMusicInterest) {
    const match = taxonomy.find((t) => t.id === 'p_def_2');
    if (match) return match;
  }

  // If user has comedy/humor passions
  if (hasHumorInterest) {
    const match = taxonomy.find((t) => t.id === 'p_def_12');
    if (match) return match;
  }

  // If user has adventure / outdoor passions
  if (hasOutdoorsInterest) {
    const match = taxonomy.find((t) => t.id === 'p_def_5');
    if (match) return match;
  }

  // 3. Match based on Relationship Intent
  if (intent === 'LONG_TERM') {
    const match = taxonomy.find((t) => t.id === 'p_def_18');
    if (match) return match;
    const matchAlt = taxonomy.find((t) => t.id === 'p_def_8');
    if (matchAlt) return matchAlt;
  }

  if (intent === 'SHORT_TERM') {
    const match = taxonomy.find((t) => t.id === 'p_def_7');
    if (match) return match;
    const matchAlt = taxonomy.find((t) => t.id === 'p_def_6');
    if (matchAlt) return matchAlt;
  }

  if (intent === 'FRIENDSHIP') {
    const match = taxonomy.find((t) => t.id === 'p_def_5');
    if (match) return match;
  }

  // 4. Bio keywords
  if (bio.includes('ritual') || bio.includes('morning') || bio.includes('routine')) {
    const match = taxonomy.find((t) => t.id === 'p_def_3');
    if (match) return match;
  }

  // 5. Default curated prompt: "My ideal Sunday morning looks like..."
  return taxonomy[0] || FALLBACK_PROMPT_DEFINITIONS[0]!;
}

export default function OnboardingPromptsScreen(): React.JSX.Element {
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

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftPrompts, setDraftPrompts, draftInterests, draftProfile, draftPhotos } =
    useOnboardingStore();

  const [availableTaxonomy, setAvailableTaxonomy] = useState<PromptDefinitionItem[]>(
    FALLBACK_PROMPT_DEFINITIONS
  );

  // Active prompt slots (1 to 3 prompts)
  const [prompts, setPrompts] = useState<ActivePromptSlot[]>(() => {
    // If user already had draft prompts saved with answers, respect them
    if (draftPrompts && draftPrompts.length > 0 && draftPrompts.some((dp) => dp.answer?.trim())) {
      return draftPrompts.slice(0, 3).map((dp, idx) => {
        const match = FALLBACK_PROMPT_DEFINITIONS.find((t) => t.id === dp.promptDefinitionId);
        return {
          promptDefinitionId: dp.promptDefinitionId,
          prompt: dp.prompt || match?.prompt || FALLBACK_PROMPT_DEFINITIONS[idx]?.prompt || '',
          category: normalizeCategoryName(match?.category),
          answer: dp.answer || '',
        };
      });
    }

    // Contextually select smart default prompt based on user's basic details, intent, and passions
    const smartDef = selectSmartDefaultPrompt(
      draftInterests,
      draftProfile,
      draftPhotos,
      FALLBACK_PROMPT_DEFINITIONS
    );

    return [
      {
        promptDefinitionId: smartDef.id,
        prompt: smartDef.prompt,
        category: normalizeCategoryName(smartDef.category),
        answer: draftPrompts?.[0]?.answer || '',
      },
    ];
  });

  // Modal Picker States
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerSelectedCategory, setPickerSelectedCategory] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(false);

  // Compact temporary error notification & shake animation
  const [errorMessage, setRawErrorMessage] = useState<string | undefined>();
  const errorAnim = useRef(new Animated.Value(0)).current;
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardShakeAnim = useRef(new Animated.Value(0)).current;

  const dismissError = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    Animated.timing(errorAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setRawErrorMessage(undefined);
    });
  };

  const showTemporaryError = (msg: string, durationMs = 1300) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setRawErrorMessage(msg);
    errorAnim.setValue(0);
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
        setRawErrorMessage(undefined);
      });
    }, durationMs);
  };

  const setErrorMessage = (msg?: string) => {
    if (!msg) {
      dismissError();
    } else {
      showTemporaryError(msg);
    }
  };

  const triggerShake = () => {
    cardShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(cardShakeAnim, {
        toValue: -5.5,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(cardShakeAnim, {
        toValue: 5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(cardShakeAnim, {
        toValue: -3.5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(cardShakeAnim, {
        toValue: 2.5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(cardShakeAnim, {
        toValue: -1,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(cardShakeAnim, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Fetch prompts taxonomy from server
  useEffect(() => {
    trackOnboardingEvent('prompts_viewed');
    let isMounted = true;

    (async () => {
      try {
        const taxonomy = await profileApi.getPromptsTaxonomy();
        if (isMounted && taxonomy && taxonomy.length > 0) {
          const merged: PromptDefinitionItem[] = [...taxonomy];
          // Ensure rich fallbacks are included if not present
          for (const fallback of FALLBACK_PROMPT_DEFINITIONS) {
            if (!merged.some((m) => m.prompt.toLowerCase() === fallback.prompt.toLowerCase())) {
              merged.push(fallback);
            }
          }
          setAvailableTaxonomy(merged);
        }
      } catch {
        // Fallback used
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handlers for Prompts CRUD
  const handleUpdateAnswer = (index: number, text: string) => {
    if (errorMessage) dismissError();
    setPrompts((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          answer: text.slice(0, 200),
        };
      }
      return next;
    });
  };

  const openPickerForSlot = (index: number) => {
    haptics.impactLight();
    setActiveSlotIndex(index);
    setPickerSearchQuery('');
    setPickerSelectedCategory('ALL');
    setIsPickerOpen(true);
  };

  const addNewPromptSlot = () => {
    if (prompts.length >= 3) return;
    haptics.impactLight();
    setActiveSlotIndex(prompts.length);
    setPickerSearchQuery('');
    setPickerSelectedCategory('ALL');
    setIsPickerOpen(true);
  };

  const removePromptSlot = (index: number) => {
    haptics.impactLight();
    if (errorMessage) dismissError();
    setPrompts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSelectPromptForSlot = (item: PromptDefinitionItem) => {
    haptics.selection();
    setPrompts((prev) => {
      const next = [...prev];
      if (activeSlotIndex < next.length && next[activeSlotIndex]) {
        next[activeSlotIndex] = {
          ...next[activeSlotIndex],
          promptDefinitionId: item.id,
          prompt: item.prompt,
          category: normalizeCategoryName(item.category),
        };
      } else if (next.length < 3) {
        next.push({
          promptDefinitionId: item.id,
          prompt: item.prompt,
          category: normalizeCategoryName(item.category),
          answer: '',
        });
      }
      return next;
    });
    setIsPickerOpen(false);
  };

  // Filtered prompts inside modal picker
  const pickerCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of availableTaxonomy) {
      set.add(normalizeCategoryName(item.category));
    }
    return ['ALL', ...Array.from(set)];
  }, [availableTaxonomy]);

  const filteredPickerPrompts = useMemo(() => {
    const q = pickerSearchQuery.trim().toLowerCase();
    return availableTaxonomy.filter((item) => {
      const normCat = normalizeCategoryName(item.category);
      if (pickerSelectedCategory !== 'ALL' && normCat !== pickerSelectedCategory) {
        return false;
      }
      if (q && !item.prompt.toLowerCase().includes(q) && !normCat.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [availableTaxonomy, pickerSearchQuery, pickerSelectedCategory]);

  const validPrompts = useMemo(() => {
    return prompts.filter((p) => p.answer.trim().length > 0);
  }, [prompts]);

  const isMinimumMet = validPrompts.length >= 1;
  const validPromptsCount = validPrompts.length;

  const handleNext = async () => {
    if (validPrompts.length === 0) {
      haptics.notificationError();
      triggerShake();
      setErrorMessage('Please write an answer to at least one prompt to continue.');
      return;
    }

    const oversized = prompts.find((p) => p.answer.trim().length > 200);
    if (oversized) {
      haptics.notificationError();
      triggerShake();
      setErrorMessage('Prompt answer cannot exceed 200 characters.');
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    const promptPayload: PromptAnswerInput[] = validPrompts.map((p, idx) => ({
      promptDefinitionId: p.promptDefinitionId,
      answer: p.answer.trim(),
      position: idx + 1,
    }));

    const draftPayload: DraftPromptItem[] = validPrompts.map((p) => ({
      promptDefinitionId: p.promptDefinitionId,
      prompt: p.prompt,
      answer: p.answer.trim(),
    }));

    setDraftPrompts(draftPayload);

    try {
      await profileApi.updateMyPrompts({ prompts: promptPayload });
      trackOnboardingEvent('prompts_completed', { promptCount: validPrompts.length });
      if (isFromReview) {
        router.replace('/(onboarding)/preview');
        return;
      }
      router.push('/(onboarding)/preferences');
    } catch {
      // Local fallback
      trackOnboardingEvent('prompts_completed', { promptCount: validPrompts.length });
      if (isFromReview) {
        router.replace('/(onboarding)/preview');
        return;
      }
      router.push('/(onboarding)/preferences');
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
      router.replace('/(onboarding)/lifestyle');
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Title Section */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              Personality Prompts
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
                07
              </Text>
            </View>
          </View>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Express your unique rhythm, humor, and lifestyle. Authentic answers spark genuine
            chemistry.
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
                transform: [
                  {
                    translateY: errorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-4, 0],
                    }),
                  },
                  {
                    scale: errorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <AlertCircle
              size={12.5}
              color={isDark ? '#FB7185' : '#E11D48'}
              strokeWidth={2.4}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.compactErrorText, { color: isDark ? '#FDA4AF' : '#E11D48' }]}
              numberOfLines={1}
            >
              {errorMessage}
            </Text>
            <TouchableOpacity
              onPress={() => dismissError()}
              style={styles.compactErrorDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice"
            >
              <X
                size={11}
                color={isDark ? 'rgba(253, 164, 175, 0.65)' : 'rgba(225, 29, 72, 0.65)'}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ======================================================== */}
        {/* Compact Curation Rhythm & Completion Progress Strip      */}
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
                {validPromptsCount === 0
                  ? 'Write at least 1 prompt to continue'
                  : validPromptsCount === 1
                    ? '1 of 3 prompts complete (Minimum met)'
                    : validPromptsCount === 2
                      ? '2 of 3 prompts complete (Recommended)'
                      : '3 of 3 prompts complete (All slots filled)'}
              </Text>
            </View>
            <Text
              style={[
                styles.compactRhythmFractionText,
                {
                  color: isMinimumMet
                    ? isDark
                      ? '#FFFFFF'
                      : '#0B0B0E'
                    : theme.colors.textTertiary,
                  fontFamily: folkraFont,
                },
              ]}
            >
              {validPromptsCount} / 3
            </Text>
          </View>

          {/* 3-segment progress indicator track */}
          <View style={styles.segmentedProgressBarTrack}>
            {[0, 1, 2].map((slotIdx) => {
              const isFilled = (prompts[slotIdx]?.answer?.trim().length || 0) > 0;
              return (
                <View
                  key={`progress-segment-${slotIdx}`}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: isFilled
                        ? isDark
                          ? '#FFFFFF'
                          : '#0B0B0E'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* ======================================================== */}
        {/* Prompt Cards Vertical Stack (with Shake Animation)       */}
        {/* ======================================================== */}
        <Animated.View
          style={[styles.promptCardsSection, { transform: [{ translateX: cardShakeAnim }] }]}
        >
          {prompts.map((item, index) => {
            const CatIcon = getPromptCategoryIcon(item.category);
            const charCount = item.answer.length;
            const isNearLimit = charCount >= 180;

            return (
              <View
                key={`prompt-slot-${index}`}
                style={[
                  styles.promptCardContainer,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E4E4E7',
                  },
                ]}
              >
                {/* Top Badge & Action Row */}
                <View style={styles.promptCardHeaderRow}>
                  <View style={styles.promptCardBadgeCluster}>
                    <View
                      style={[
                        styles.promptCategoryBadge,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.05)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    >
                      <CatIcon
                        size={11.5}
                        color={theme.colors.textSecondary}
                        strokeWidth={2.2}
                        style={{ marginRight: 4.5 }}
                      />
                      <Text
                        style={[
                          styles.promptCategoryBadgeText,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        {item.category || 'Personality'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.promptCardSlotNumber,
                        { color: theme.colors.textTertiary, fontFamily: folkraFont },
                      ]}
                    >
                      0{index + 1}
                    </Text>
                  </View>

                  <View style={styles.promptCardHeaderActions}>
                    <TouchableOpacity
                      onPress={() => openPickerForSlot(index)}
                      style={[
                        styles.promptChangeButton,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.09)',
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Change question for prompt ${index + 1}`}
                    >
                      <RotateCw
                        size={11}
                        color={theme.colors.textSecondary}
                        strokeWidth={2.2}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.promptChangeButtonText, { color: theme.colors.textPrimary }]}
                      >
                        Change
                      </Text>
                    </TouchableOpacity>

                    {prompts.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removePromptSlot(index)}
                        style={[
                          styles.promptRemoveButton,
                          {
                            backgroundColor: isDark
                              ? 'rgba(244, 63, 94, 0.10)'
                              : 'rgba(244, 63, 94, 0.07)',
                            borderColor: isDark
                              ? 'rgba(244, 63, 94, 0.20)'
                              : 'rgba(244, 63, 94, 0.15)',
                          },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove prompt ${index + 1}`}
                      >
                        <Trash2 size={12} color="#F43F5E" strokeWidth={2.2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Prompt Question Tap Area */}
                <TouchableOpacity
                  onPress={() => openPickerForSlot(index)}
                  activeOpacity={0.78}
                  style={styles.promptQuestionWrap}
                >
                  <Text
                    style={[
                      styles.promptQuestionTitle,
                      { color: theme.colors.textPrimary, fontFamily: folkraFont },
                    ]}
                  >
                    "{item.prompt}"
                  </Text>
                </TouchableOpacity>

                {/* Recessed Answer Text Area */}
                <View
                  style={[
                    styles.answerInputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <TextInput
                    multiline
                    placeholder="Write your candid, honest answer here..."
                    placeholderTextColor={theme.colors.textTertiary}
                    value={item.answer}
                    onChangeText={(text) => handleUpdateAnswer(index, text)}
                    maxLength={200}
                    style={[styles.answerTextInput, { color: theme.colors.textPrimary }]}
                    textAlignVertical="top"
                  />

                  {/* Character Counter & Tip */}
                  <View style={styles.answerFooterRow}>
                    <Text style={[styles.answerTipText, { color: theme.colors.textTertiary }]}>
                      Specific details make great conversation starters
                    </Text>
                    <View
                      style={[
                        styles.charCountBadge,
                        {
                          backgroundColor: isNearLimit
                            ? isDark
                              ? 'rgba(245, 158, 11, 0.16)'
                              : '#FEF3C7'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.04)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.charCountText,
                          {
                            color: isNearLimit
                              ? isDark
                                ? '#FBBF24'
                                : '#D97706'
                              : theme.colors.textTertiary,
                          },
                        ]}
                      >
                        {charCount} / 200
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Add Another Prompt Slot Button (when slots < 3) */}
          {prompts.length < 3 && (
            <TouchableOpacity
              onPress={addNewPromptSlot}
              style={[
                styles.addPromptSlotButton,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#D4D4D8',
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.025)'
                    : 'rgba(255, 255, 255, 0.65)',
                },
              ]}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Add personality prompt ${prompts.length + 1}`}
            >
              <View
                style={[
                  styles.addPromptIconCircle,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
                <Plus size={17} color={theme.colors.textPrimary} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.addPromptTitle,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  {prompts.length === 1
                    ? 'Add a 2nd prompt (Recommended)'
                    : 'Add a 3rd prompt (Complete profile)'}
                </Text>
                <Text style={[styles.addPromptSubtitle, { color: theme.colors.textTertiary }]}>
                  Profiles with multiple prompts receive 2.4x more conversation starters.
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Bottom clearance spacer so bottom cards are never covered by floating action button */}
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
          {/* Professional CTA Button (Solid, Non-See-Through Button) */}
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
                opacity: isLoading ? 0.75 : isMinimumMet ? 1 : 0.6,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isFromReview
                ? 'Back to Review'
                : isMinimumMet
                  ? `Continue to preferences (${validPromptsCount} prompt${validPromptsCount > 1 ? 's' : ''} answered)`
                  : 'Answer at least 1 prompt to continue (0 of 1 completed)'
            }
            testID="prompts-continue-button"
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
                  numberOfLines={1}
                >
                  {isFromReview
                    ? 'Back to Review'
                    : isMinimumMet
                      ? 'Continue to Preferences'
                      : 'Answer at least 1 prompt (0/1)'}
                </Text>
                {(isFromReview || isMinimumMet) && <ArrowRight size={17} color="#000000" style={{ marginLeft: 8 }} />}
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            Prompts appear directly on your profile card to spark authentic conversation.
          </Text>
        </View>
      </View>

      {/* ======================================================== */}
      {/* Smooth Bottom Sheet Modal for Prompt Question Picker     */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isPickerOpen}
        onClose={() => {
          Keyboard.dismiss();
          setIsPickerOpen(false);
        }}
        onDismiss={() => {
          setPickerSearchQuery('');
          setPickerSelectedCategory('ALL');
        }}
        height="86%"
        disableKeyboardAvoiding={true}
        sheetStyle={{
          paddingBottom: Math.max(insets.bottom + 12, 28),
        }}
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
              Select a Prompt
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textTertiary }]}>
              Choose a question that sparks real chemistry
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setIsPickerOpen(false);
            }}
            style={[
              styles.modalCloseButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close prompt question picker"
          >
            <X size={16} color={theme.colors.textSecondary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Modal Search Bar */}
        <View
          style={[
            styles.modalSearchRow,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} strokeWidth={2.2} />
          <TextInput
            placeholder="Search prompt questions..."
            placeholderTextColor={theme.colors.textTertiary}
            value={pickerSearchQuery}
            onChangeText={setPickerSearchQuery}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {pickerSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setPickerSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={theme.colors.textTertiary} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter Chips with Soft Faded Dark Edges */}
        <View style={styles.modalFilterChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modalFilterChipsContainer}
            style={styles.modalFilterChipsScroll}
          >
            {pickerCategories.map((cat) => {
              const isSelected = pickerSelectedCategory === cat;
              return (
                <TouchableOpacity
                  key={`cat-filter-${cat}`}
                  onPress={() => {
                    haptics.impactLight();
                    setPickerSelectedCategory(cat);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#0B0B0E'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#0B0B0E'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(0, 0, 0, 0.07)',
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected
                          ? isDark
                            ? '#000000'
                            : '#FFFFFF'
                          : theme.colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat === 'ALL' ? 'All Questions' : cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Left soft dark feathered fade */}
          <LinearGradient
            colors={
              isDark
                ? ['#121215', 'rgba(18, 18, 21, 0.85)', 'rgba(18, 18, 21, 0.0)']
                : ['#FCFCFD', 'rgba(252, 252, 253, 0.85)', 'rgba(252, 252, 253, 0.0)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalFilterChipsFadeLeft}
            pointerEvents="none"
          />

          {/* Right soft dark feathered fade */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(18, 18, 21, 0.0)', 'rgba(18, 18, 21, 0.85)', '#121215']
                : ['rgba(252, 252, 253, 0.0)', 'rgba(252, 252, 253, 0.85)', '#FCFCFD']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalFilterChipsFadeRight}
            pointerEvents="none"
          />
        </View>

        {/* Filtered Prompts List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalPromptsListContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredPickerPrompts.map((item) => {
            const isCurrentlySelectedInActiveSlot =
              prompts[activeSlotIndex]?.promptDefinitionId === item.id;
            const isUsedInOtherSlot = prompts.some(
              (p, idx) => idx !== activeSlotIndex && p.promptDefinitionId === item.id
            );
            const PromptIcon = getPromptCategoryIcon(item.category);

            return (
              <TouchableOpacity
                key={`picker-prompt-${item.id}`}
                disabled={isUsedInOtherSlot}
                onPress={() => handleSelectPromptForSlot(item)}
                style={[
                  styles.pickerPromptCard,
                  {
                    backgroundColor: isCurrentlySelectedInActiveSlot
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.09)'
                        : 'rgba(0, 0, 0, 0.04)'
                      : isUsedInOtherSlot
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'rgba(0, 0, 0, 0.02)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : '#FFFFFF',
                    borderColor: isCurrentlySelectedInActiveSlot
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.40)'
                        : '#0B0B0E'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#E4E4E7',
                    opacity: isUsedInOtherSlot ? 0.45 : 1,
                  },
                ]}
                activeOpacity={0.78}
              >
                <View style={styles.pickerPromptCardTop}>
                  <View
                    style={[
                      styles.pickerPromptCategoryBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <PromptIcon
                      size={11}
                      color={theme.colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.pickerPromptCategoryText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {item.category || 'General'}
                    </Text>
                  </View>
                  {isCurrentlySelectedInActiveSlot && (
                    <View
                      style={[
                        styles.pickerActiveCheckCircle,
                        { backgroundColor: isDark ? '#FFFFFF' : '#0B0B0E' },
                      ]}
                    >
                      <Check size={10} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                    </View>
                  )}
                  {isUsedInOtherSlot && (
                    <Text style={[styles.pickerInUseText, { color: theme.colors.textTertiary }]}>
                      Already added
                    </Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.pickerPromptQuestionText,
                    {
                      color: isUsedInOtherSlot
                        ? theme.colors.textTertiary
                        : theme.colors.textPrimary,
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  "{item.prompt}"
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SmoothBottomSheetModal>
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
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
  },
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
  // Compact, Professional Validation Pill
  compactErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 5.5,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  compactErrorText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  compactErrorDismiss: {
    marginLeft: 7,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact Curation & Rhythm Progress Bar
  compactRhythmSection: {
    marginBottom: 20,
  },
  compactRhythmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  compactRhythmFractionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  segmentedProgressBarTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 3.5,
  },
  progressSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  // Prompt Cards Section
  promptCardsSection: {
    gap: 16,
  },
  promptCardContainer: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  promptCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promptCardBadgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promptCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  promptCardSlotNumber: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  promptCardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  promptChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptChangeButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  promptRemoveButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptQuestionWrap: {
    marginBottom: 12,
  },
  promptQuestionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  answerInputContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 112,
  },
  answerTextInput: {
    fontSize: 14.5,
    lineHeight: 21,
    minHeight: 64,
    padding: 0,
    textAlignVertical: 'top',
  },
  answerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  answerTipText: {
    fontSize: 10.5,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  charCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  charCountText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  // Add Another Prompt Slot Button
  addPromptSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 13,
  },
  addPromptIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPromptTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  addPromptSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '400',
  },
  dockClearanceSpacer: {
    height: 156,
  },
  // Floating Bottom Dock with Feathered Fade (Matching interests.tsx)
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
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 20,
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
    gap: 8,
  },
  professionalCtaText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 20,
    textAlign: 'center',
  },
  dockFootnoteText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  // Smooth Bottom Sheet Modal Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 13,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13.5,
    marginLeft: 9,
    paddingVertical: 0,
  },
  modalFilterChipsWrapper: {
    position: 'relative',
    height: 44,
    marginBottom: 14,
    justifyContent: 'center',
  },
  modalFilterChipsScroll: {
    flexGrow: 0,
    height: 44,
  },
  modalFilterChipsContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.15,
    includeFontPadding: false,
  },
  modalFilterChipsFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 5,
  },
  modalFilterChipsFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 5,
  },
  modalPromptsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  pickerPromptCard: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
  },
  pickerPromptCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerPromptCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  pickerPromptCategoryText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  pickerActiveCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerInUseText: {
    fontSize: 10.5,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  pickerPromptQuestionText: {
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 21,
  },
});
