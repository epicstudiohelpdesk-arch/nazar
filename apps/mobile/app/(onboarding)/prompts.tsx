import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { PromptDefinitionItem, PromptAnswerInput } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

const FALLBACK_PROMPT_DEFINITIONS: PromptDefinitionItem[] = [
  {
    id: 'p_def_1',
    prompt: 'My ideal Sunday morning looks like...',
    category: 'Lifestyle',
    sortOrder: 1,
  },
  {
    id: 'p_def_2',
    prompt: 'A non-negotiable for me in a relationship is...',
    category: 'Values',
    sortOrder: 2,
  },
  {
    id: 'p_def_3',
    prompt: 'The best chai / coffee spot in my city is...',
    category: 'Food & Drink',
    sortOrder: 3,
  },
  {
    id: 'p_def_4',
    prompt: 'I geek out endlessly on...',
    category: 'Passions',
    sortOrder: 4,
  },
  {
    id: 'p_def_5',
    prompt: 'The quickest way to make me laugh is...',
    category: 'Humor',
    sortOrder: 5,
  },
  {
    id: 'p_def_6',
    prompt: 'Together, we could finally...',
    category: 'Dates',
    sortOrder: 6,
  },
];

export default function OnboardingPromptsScreen(): React.JSX.Element {
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

  const { draftPrompts, setDraftPrompts } = useOnboardingStore();

  const [availableTaxonomy, setAvailableTaxonomy] = useState<PromptDefinitionItem[]>(
    FALLBACK_PROMPT_DEFINITIONS
  );
  const [selectedPromptDef, setSelectedPromptDef] = useState<PromptDefinitionItem>(
    FALLBACK_PROMPT_DEFINITIONS[0]!
  );
  const [answer, setAnswer] = useState(
    draftPrompts[0]?.answer ||
      'Early morning filter coffee at Matunga, followed by scouring second-hand books in Fort.'
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    trackOnboardingEvent('prompts_viewed');
    let isMounted = true;

    (async () => {
      try {
        const taxonomy = await profileApi.getPromptsTaxonomy();
        if (isMounted && taxonomy && taxonomy.length > 0) {
          setAvailableTaxonomy(taxonomy);
          const firstDraft = draftPrompts[0];
          if (firstDraft?.promptDefinitionId) {
            const found = taxonomy.find((t) => t.id === firstDraft.promptDefinitionId);
            if (found) setSelectedPromptDef(found);
          } else {
            const firstTax = taxonomy[0];
            if (firstTax) setSelectedPromptDef(firstTax);
          }
        }
      } catch {
        // Fallback used
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectPrompt = (item: PromptDefinitionItem) => {
    haptics.selection();
    setSelectedPromptDef(item);
    setIsPickerOpen(false);
  };

  const handleNext = async () => {
    if (!answer.trim()) {
      haptics.notificationError();
      setErrorMessage('Please write a response to this prompt to spark conversation.');
      return;
    }

    if (answer.trim().length > 200) {
      haptics.notificationError();
      setErrorMessage('Prompt answer cannot exceed 200 characters.');
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    const promptPayload: PromptAnswerInput = {
      promptDefinitionId: selectedPromptDef.id,
      answer: answer.trim(),
      position: 1,
    };

    setDraftPrompts([
      {
        promptDefinitionId: selectedPromptDef.id,
        prompt: selectedPromptDef.prompt,
        answer: answer.trim(),
      },
    ]);

    try {
      await profileApi.updateMyPrompts({ prompts: [promptPayload] });
      trackOnboardingEvent('prompts_completed', { promptCount: 1 });
      router.push('/(onboarding)/preferences');
    } catch {
      // Local fallback
      trackOnboardingEvent('prompts_completed', { promptCount: 1 });
      router.push('/(onboarding)/preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/interests');
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
                06
              </Text>
            </View>
          </View>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Prompts give people a glimpse into your humor, rhythm, and day-to-day life.
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

        <View style={styles.promptSection}>
          {/* Question Selector Trigger */}
          <TouchableOpacity
            style={[
              styles.questionHeader,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.accent,
                borderWidth: 1,
              },
            ]}
            onPress={() => setIsPickerOpen(!isPickerOpen)}
            accessibilityRole="button"
            accessibilityLabel="Select different prompt question"
          >
            <View style={{ flex: 1 }}>
              <Text
                level="caption"
                style={{
                  color: theme.colors.accent,
                  fontWeight: '700',
                  fontFamily: folkraFont,
                  letterSpacing: 1.5,
                }}
              >
                PROMPT QUESTION (TAP TO CHANGE)
              </Text>
              <Text
                level="title"
                style={{
                  color: theme.colors.textPrimary,
                  fontStyle: 'italic',
                  marginTop: 4,
                  fontFamily: folkraFont,
                }}
              >
                "{selectedPromptDef.prompt}"
              </Text>
            </View>
            <Icon
              name="chevron"
              direction={isPickerOpen ? 'up' : 'down'}
              size="sm"
              color={theme.colors.accent}
            />
          </TouchableOpacity>

          {/* Collapsible Questions List */}
          {isPickerOpen && (
            <View
              style={[
                styles.optionsList,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              {availableTaxonomy.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionItem,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor:
                        item.id === selectedPromptDef.id ? theme.colors.accentSoft : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelectPrompt(item)}
                >
                  <Text
                    level="bodySmall"
                    style={{
                      color:
                        item.id === selectedPromptDef.id
                          ? theme.colors.accentStrong
                          : theme.colors.textPrimary,
                      fontWeight: item.id === selectedPromptDef.id ? '700' : '400',
                    }}
                  >
                    "{item.prompt}"
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Answer Input */}
          <View style={styles.answerBox}>
            <MultilineInput
              label={`Your Answer (${answer.length}/200)`}
              placeholder="Write your honest, candid answer here..."
              value={answer}
              onChangeText={(t) => {
                setAnswer(t.slice(0, 200));
                if (errorMessage) setErrorMessage(undefined);
              }}
              maxLength={200}
              style={{ minHeight: 110 }}
            />
          </View>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            onPress={handleNext}
            accessibilityLabel="Continue to discovery preferences"
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
  promptSection: {
    marginVertical: 24,
    gap: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
  },
  optionsList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionItem: {
    padding: 14,
    borderBottomWidth: 1,
  },
  answerBox: {
    marginTop: 4,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
