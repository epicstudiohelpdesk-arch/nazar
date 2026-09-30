import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Slider } from '../../src/design/components/input/Slider.js';
import { Select } from '../../src/design/components/input/Select.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../../src/profile/profile-api.js';
import { DISCOVERY_QUERY_KEYS } from '../../src/discovery/discovery-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

const CANONICAL_DEFAULTS = {
  distanceKm: 50,
  minAge: 21,
  maxAge: 35,
  genderPref: 'ALL',
  intentPref: 'LONG_TERM' as RelationshipIntent,
};

export default function FiltersModalRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const profileApi = getDefaultProfileApi();

  const [distanceKm, setDistanceKm] = useState(CANONICAL_DEFAULTS.distanceKm);
  const [minAge, setMinAge] = useState(CANONICAL_DEFAULTS.minAge);
  const [maxAge, setMaxAge] = useState(CANONICAL_DEFAULTS.maxAge);
  const [genderPref, setGenderPref] = useState(CANONICAL_DEFAULTS.genderPref);
  const [intentPref, setIntentPref] = useState<RelationshipIntent>(CANONICAL_DEFAULTS.intentPref);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user preferences from server
  const { data: serverPreferences, isLoading } = useQuery({
    queryKey: PROFILE_QUERY_KEYS.preferences,
    queryFn: async () => profileApi.getPreferences(),
  });

  // Hydrate local state from server preferences
  useEffect(() => {
    if (serverPreferences) {
      if (serverPreferences.maxDistanceKm) setDistanceKm(serverPreferences.maxDistanceKm);
      if (serverPreferences.minAge) setMinAge(serverPreferences.minAge);
      if (serverPreferences.maxAge) setMaxAge(serverPreferences.maxAge);
      if (serverPreferences.relationshipIntent) setIntentPref(serverPreferences.relationshipIntent);

      const prefs = serverPreferences.genderPreferences || [];
      if (prefs.length === 1 && prefs[0]) {
        setGenderPref(prefs[0]);
      } else {
        setGenderPref('ALL');
      }
    }
  }, [serverPreferences]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      let resolvedGenders: Gender[];
      if (genderPref === 'ALL') {
        resolvedGenders = ['MAN', 'WOMAN', 'NON_BINARY'];
      } else {
        resolvedGenders = [genderPref as Gender];
      }

      return profileApi.updatePreferences({
        maxDistanceKm: distanceKm,
        minAge,
        maxAge,
        genderPreferences: resolvedGenders,
        relationshipIntent: intentPref,
      });
    },
    onSuccess: () => {
      trackOnboardingEvent('filter_applied', {
        minAge,
        maxAge,
        maxDistanceKm: distanceKm,
        intent: intentPref,
      });

      // Invalidate queries so discovery feed re-queries with new preferences
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.preferences });
      queryClient.invalidateQueries({ queryKey: DISCOVERY_QUERY_KEYS.feed });

      router.back();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save preferences';
      Alert.alert('Error', msg);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleApply = () => {
    setIsSubmitting(true);
    updateMutation.mutate();
  };

  const handleReset = () => {
    setDistanceKm(CANONICAL_DEFAULTS.distanceKm);
    setMinAge(CANONICAL_DEFAULTS.minAge);
    setMaxAge(CANONICAL_DEFAULTS.maxAge);
    setGenderPref(CANONICAL_DEFAULTS.genderPref);
    setIntentPref(CANONICAL_DEFAULTS.intentPref);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Discovery Preferences"
        onBack={() => router.back()}
        leftAction="close"
        rightAction={
          <Button
            variant="tertiary"
            size="sm"
            onPress={handleReset}
            accessibilityLabel="Reset filters"
          >
            Reset
          </Button>
        }
      />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading preferences...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SurfaceCard elevation="sm" style={styles.card}>
            <Heading level="h3">Maximum Distance</Heading>
            <Text level="title" color="accent">
              Within {distanceKm} km
            </Text>
            <Slider
              label=""
              value={distanceKm}
              minimumValue={5}
              maximumValue={150}
              step={5}
              onValueChange={setDistanceKm}
            />
          </SurfaceCard>

          <SurfaceCard elevation="sm" style={styles.card}>
            <Heading level="h3">Age Range</Heading>
            <Text level="title" color="accent">
              {minAge} – {maxAge} years
            </Text>
            <Slider
              label="Minimum Age"
              value={minAge}
              minimumValue={18}
              maximumValue={Math.min(maxAge - 1, 50)}
              step={1}
              onValueChange={setMinAge}
            />
            <Slider
              label="Maximum Age"
              value={maxAge}
              minimumValue={Math.max(minAge + 1, 19)}
              maximumValue={65}
              step={1}
              onValueChange={setMaxAge}
            />
          </SurfaceCard>

          <SurfaceCard elevation="sm" style={styles.card}>
            <Heading level="h3">Interested In</Heading>
            <Select
              label=""
              value={genderPref}
              options={[
                { label: 'Everyone', value: 'ALL' },
                { label: 'Women', value: 'WOMAN' },
                { label: 'Men', value: 'MAN' },
                { label: 'Non-binary', value: 'NON_BINARY' },
              ]}
              onSelectOption={setGenderPref}
            />
          </SurfaceCard>

          <SurfaceCard elevation="sm" style={styles.card}>
            <Heading level="h3">Relationship Intent</Heading>
            <Select
              label=""
              value={intentPref}
              options={[
                { label: 'Long-term / Marriage', value: 'LONG_TERM' },
                { label: 'Short-term dating', value: 'SHORT_TERM' },
                { label: 'Casual exploration', value: 'CASUAL' },
                { label: 'Friendship & networking', value: 'FRIENDSHIP' },
                { label: 'Still figuring it out', value: 'NOT_SURE' },
              ]}
              onSelectOption={(val) => setIntentPref(val as RelationshipIntent)}
            />
          </SurfaceCard>

          <View style={styles.buttonWrapper}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              onPress={handleApply}
              accessibilityLabel="Apply discovery preferences"
            >
              Apply Preferences
            </Button>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    gap: 8,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
