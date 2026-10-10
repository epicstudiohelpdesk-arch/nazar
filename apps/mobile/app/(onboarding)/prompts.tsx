import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { PromptDefinitionItem, PromptAnswerInput } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

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
  const { theme } = useTheme();
  const profileApi = getDefaultProfileApi();

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
    setSelectedPromptDef(item);
    setIsPickerOpen(false);
  };

  const handleNext = async () => {
    if (!answer.trim()) {
      setErrorMessage('Please write a response to this prompt to spark conversation.');
      return;
    }

    if (answer.trim().length > 200) {
      setErrorMessage('Prompt answer cannot exceed 200 characters.');
      return;
    }

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />
      <ProgressBar progress={0.65} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text level="label" color="accent">
            STEP 4 OF 6
          </Text>
          <Heading level="h1">Personality Prompts</Heading>
          <Text level="body" color="secondary">
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
              <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                PROMPT QUESTION (TAP TO CHANGE)
              </Text>
              <Text
                level="title"
                style={{ color: theme.colors.textPrimary, fontStyle: 'italic', marginTop: 4 }}
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
