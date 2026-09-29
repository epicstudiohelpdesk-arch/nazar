import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { ImagePickerTrigger } from '../../src/design/components/input/ImagePickerTrigger.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';

export default function OnboardingPhotosScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [photos, setPhotos] = useState<Array<string | null>>([
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    null,
    null,
    null,
    null,
    null,
  ]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const filledCount = photos.filter(Boolean).length;

  const handleNext = () => {
    if (filledCount < 2) {
      setErrorMessage('Please upload at least 2 photos of yourself.');
      return;
    }
    setErrorMessage(undefined);
    router.push('/(onboarding)/interests');
  };

  const handlePhotoSelect = (index: number) => {
    // In local dev preview: toggle a demo portrait image
    const updated = [...photos];
    if (updated[index]) {
      updated[index] = null;
    } else {
      updated[index] = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500';
    }
    setPhotos(updated);
    if (errorMessage) setErrorMessage(undefined);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={0.4} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text level="label" color="accent">STEP 2 OF 5</Text>
          <Heading level="h1">Add your photos</Heading>
          <Text level="body" color="secondary">
            Upload at least 2 clear photos. Natural lighting and candid portraits work best.
          </Text>
        </View>

        {errorMessage && (
          <Text level="bodySmall" color="error" style={styles.errorText}>
            {errorMessage}
          </Text>
        )}

        <View style={styles.grid}>
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.slotWrapper}>
              <ImagePickerTrigger
                imageUri={uri || undefined}
                onPickImage={() => handlePhotoSelect(idx)}
                onRemoveImage={() => handlePhotoSelect(idx)}
              />
            </View>
          ))}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleNext}
            accessibilityLabel="Continue to interests selection"
          >
            Continue ({filledCount}/2 Required)
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 24,
  },
  slotWrapper: {
    width: '30%',
    aspectRatio: 3 / 4,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
