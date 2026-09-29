import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';

export default function OnboardingPromptsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [promptAnswer, setPromptAnswer] = useState(
    'Early morning filter coffee at Matunga, followed by scouring second-hand book stalls in Fort.'
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleNext = () => {
    if (!promptAnswer.trim()) {
      setErrorMessage('Please answer at least one prompt to break the ice.');
      return;
    }
    setErrorMessage(undefined);
    router.push('/(onboarding)/permissions');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={0.8} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text level="label" color="accent">STEP 4 OF 5</Text>
          <Heading level="h1">Personality Prompts</Heading>
          <Text level="body" color="secondary">
            Prompts give other people a glimpse into your humor, rhythm, and day-to-day life.
          </Text>
        </View>

        <View style={styles.promptCard}>
          <SurfaceCard elevation="sm" style={styles.cardInner}>
            <Text level="title" style={styles.promptQuestion}>
              "My ideal Sunday morning looks like..."
            </Text>
            <MultilineInput
              label=""
              placeholder="Write your answer here..."
              value={promptAnswer}
              onChangeText={(t) => {
                setPromptAnswer(t);
                if (errorMessage) setErrorMessage(undefined);
              }}
              maxLength={200}
              errorMessage={errorMessage}
            />
          </SurfaceCard>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleNext}
            accessibilityLabel="Continue to permissions"
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
    paddingBottom: 32,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  promptCard: {
    marginVertical: 24,
  },
  cardInner: {
    padding: 16,
    gap: 12,
  },
  promptQuestion: {
    fontStyle: 'italic',
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
