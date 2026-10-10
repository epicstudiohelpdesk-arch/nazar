import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

const GENDER_OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: 'Men', value: 'MAN' },
  { label: 'Women', value: 'WOMAN' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Everyone', value: 'OTHER' },
];

const DISTANCE_PRESETS = [10, 25, 50, 100, 200];

export default function OnboardingPreferencesScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const profileApi = getDefaultProfileApi();

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
    if (selectedGenders.includes(val)) {
      if (selectedGenders.length <= 1) return; // Keep at least one
      setSelectedGenders(selectedGenders.filter((g) => g !== val));
    } else {
      setSelectedGenders([...selectedGenders, val]);
    }
  };

  const handleNext = async () => {
    if (minAge < 18) {
      setErrorMessage('Minimum age preference must be at least 18.');
      return;
    }
    if (minAge > maxAge) {
      setErrorMessage('Minimum age cannot be greater than maximum age.');
      return;
    }
    if (selectedGenders.length === 0) {
      setErrorMessage('Please select who you are interested in discovering.');
      return;
    }

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />
      <ProgressBar progress={0.8} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text level="label" color="accent">
            STEP 5 OF 6
          </Text>
          <Heading level="h1">Discovery Preferences</Heading>
          <Text level="body" color="secondary">
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
            <Text level="title" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
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
              <Text level="title" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
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
                    onPress={() => setMinAge((prev) => Math.max(18, prev - 1))}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease minimum age"
                  >
                    <Text level="title">-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMinAge((prev) => Math.min(maxAge - 1, prev + 1))}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase minimum age"
                  >
                    <Text level="title">+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperCol}>
                <Text level="caption" color="secondary">
                  Max Age: {maxAge}
                </Text>
                <View style={styles.stepperBtns}>
                  <TouchableOpacity
                    onPress={() => setMaxAge((prev) => Math.max(minAge + 1, prev - 1))}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease maximum age"
                  >
                    <Text level="title">-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMaxAge((prev) => Math.min(70, prev + 1))}
                    style={[styles.stepBtn, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase maximum age"
                  >
                    <Text level="title">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SurfaceCard>

          {/* Maximum distance */}
          <SurfaceCard elevation="none" style={[styles.card, { borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text level="title" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
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
                    onPress={() => setMaxDistanceKm(d)}
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
