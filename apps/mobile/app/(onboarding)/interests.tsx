import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { ChipSelector } from '../../src/design/components/input/ChipSelector.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';

const AVAILABLE_INTERESTS = [
  { id: '1', label: 'Filter Coffee ☕' },
  { id: '2', label: 'Hindustani Classical 🎵' },
  { id: '3', label: 'Indie Cinema 🎬' },
  { id: '4', label: 'Street Food & Chaat 🥟' },
  { id: '5', label: 'Weekend Trekking ⛰️' },
  { id: '6', label: 'Modern Art 🎨' },
  { id: '7', label: 'Books & Literature 📚' },
  { id: '8', label: 'Cricket & IPL 🏏' },
  { id: '9', label: 'Board Games 🎲' },
  { id: '10', label: 'Architecture & Design 🏛️' },
  { id: '11', label: 'Yoga & Mindfulness 🧘' },
  { id: '12', label: 'Live Concerts 🎸' },
];

export default function OnboardingInterestsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [selectedIds, setSelectedIds] = useState<string[]>(['1', '3']);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleNext = () => {
    if (selectedIds.length < 3) {
      setErrorMessage('Please select at least 3 interests that represent you.');
      return;
    }
    setErrorMessage(undefined);
    router.push('/(onboarding)/prompts');
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 10) return;
      setSelectedIds([...selectedIds, id]);
    }
    if (errorMessage) setErrorMessage(undefined);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={0.6} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text level="label" color="accent">STEP 3 OF 5</Text>
          <Heading level="h1">What are you into?</Heading>
          <Text level="body" color="secondary">
            Select 3 to 10 passions to help us discover people who share your vibe.
          </Text>
        </View>

        {errorMessage && (
          <Text level="bodySmall" color="error" style={styles.errorText}>
            {errorMessage}
          </Text>
        )}

        <View style={styles.chipsSection}>
          <ChipSelector
            options={AVAILABLE_INTERESTS}
            selectedValues={selectedIds}
            onToggleValue={handleToggle}
            maxSelectable={10}
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleNext}
            accessibilityLabel="Continue to personality prompts"
          >
            Continue ({selectedIds.length}/3 Selected)
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
  errorText: {
    marginTop: 12,
  },
  chipsSection: {
    marginVertical: 24,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
