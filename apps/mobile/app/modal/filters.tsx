import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Gender, RelationshipIntent, FamilyPlans } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { Badge } from '../../src/design/primitives/Badge.js';
import { Slider } from '../../src/design/components/input/Slider.js';
import { Select } from '../../src/design/components/input/Select.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../../src/profile/profile-api.js';
import { DISCOVERY_QUERY_KEYS } from '../../src/discovery/discovery-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { PremiumGate } from '../../src/billing/PremiumGate.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

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
  const { maxContentWidth } = useResponsiveLayout();

  const [distanceKm, setDistanceKm] = useState(CANONICAL_DEFAULTS.distanceKm);
  const [distanceIsDealbreaker, setDistanceIsDealbreaker] = useState(false);
  const [minAge, setMinAge] = useState(CANONICAL_DEFAULTS.minAge);
  const [maxAge, setMaxAge] = useState(CANONICAL_DEFAULTS.maxAge);
  const [ageIsDealbreaker, setAgeIsDealbreaker] = useState(false);
  const [genderPref, setGenderPref] = useState(CANONICAL_DEFAULTS.genderPref);
  const [intentPref, setIntentPref] = useState<RelationshipIntent>(CANONICAL_DEFAULTS.intentPref);
  const [intentIsDealbreaker, setIntentIsDealbreaker] = useState(false);
  const [familyPlans, setFamilyPlans] = useState<FamilyPlans>('NOT_SURE');
  const [familyPlansIsDealbreaker, setFamilyPlansIsDealbreaker] = useState(false);
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
      if (serverPreferences.distanceIsDealbreaker !== undefined)
        setDistanceIsDealbreaker(serverPreferences.distanceIsDealbreaker);
      if (serverPreferences.minAge) setMinAge(serverPreferences.minAge);
      if (serverPreferences.maxAge) setMaxAge(serverPreferences.maxAge);
      if (serverPreferences.ageIsDealbreaker !== undefined)
        setAgeIsDealbreaker(serverPreferences.ageIsDealbreaker);
      if (serverPreferences.relationshipIntent) setIntentPref(serverPreferences.relationshipIntent);
      if (serverPreferences.intentIsDealbreaker !== undefined)
        setIntentIsDealbreaker(serverPreferences.intentIsDealbreaker);
      if (serverPreferences.familyPlans)
        setFamilyPlans(serverPreferences.familyPlans as FamilyPlans);
      if (serverPreferences.familyPlansIsDealbreaker !== undefined)
        setFamilyPlansIsDealbreaker(serverPreferences.familyPlansIsDealbreaker);

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
        distanceIsDealbreaker,
        minAge,
        maxAge,
        ageIsDealbreaker,
        genderPreferences: resolvedGenders,
        relationshipIntent: intentPref,
        intentIsDealbreaker,
        familyPlans,
        familyPlansIsDealbreaker,
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

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/discovery');
      }
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
    haptics.medium();
    setIsSubmitting(true);
    updateMutation.mutate();
  };

  const handleReset = () => {
    haptics.light();
    setDistanceKm(CANONICAL_DEFAULTS.distanceKm);
    setDistanceIsDealbreaker(false);
    setMinAge(CANONICAL_DEFAULTS.minAge);
    setMaxAge(CANONICAL_DEFAULTS.maxAge);
    setAgeIsDealbreaker(false);
    setGenderPref(CANONICAL_DEFAULTS.genderPref);
    setIntentPref(CANONICAL_DEFAULTS.intentPref);
    setIntentIsDealbreaker(false);
    setFamilyPlans('NOT_SURE');
    setFamilyPlansIsDealbreaker(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Discovery Preferences"
        onBack={handleBack}
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
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { maxWidth: maxContentWidth || 540, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Distance Filter */}
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="location" size="sm" color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Heading level="h3">Maximum Distance</Heading>
                <Text level="title" color="accent" style={{ marginTop: 2, fontWeight: '700' }}>
                  Within {distanceKm} km
                </Text>
              </View>
            </View>

            <Slider
              label=""
              value={distanceKm}
              minimumValue={5}
              maximumValue={150}
              step={5}
              onValueChange={setDistanceKm}
            />

            <View style={[styles.dealbreakerRow, { borderTopColor: theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text level="bodySmall" weight="bold">
                    Dealbreaker
                  </Text>
                  {distanceIsDealbreaker && <Badge variant="accent" label="Strict" size="sm" />}
                </View>
                <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                  Only show people strictly within this distance
                </Text>
              </View>
              <Switch
                value={distanceIsDealbreaker}
                onValueChange={(val) => {
                  haptics.selection();
                  setDistanceIsDealbreaker(val);
                }}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </SurfaceCard>

          {/* Age Range Filter */}
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="calendar" size="sm" color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Heading level="h3">Age Range</Heading>
                <Text level="title" color="accent" style={{ marginTop: 2, fontWeight: '700' }}>
                  {minAge} – {maxAge} years
                </Text>
              </View>
            </View>

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

            <View style={[styles.dealbreakerRow, { borderTopColor: theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text level="bodySmall" weight="bold">
                    Dealbreaker
                  </Text>
                  {ageIsDealbreaker && <Badge variant="accent" label="Strict" size="sm" />}
                </View>
                <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                  Only show people strictly within this age range
                </Text>
              </View>
              <Switch
                value={ageIsDealbreaker}
                onValueChange={(val) => {
                  haptics.selection();
                  setAgeIsDealbreaker(val);
                }}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </SurfaceCard>

          {/* Gender Preferences Filter */}
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="heart" size="sm" color={theme.colors.accent} />
              </View>
              <Heading level="h3">Interested In</Heading>
            </View>

            <Select
              label=""
              value={genderPref}
              options={[
                { label: 'Everyone', value: 'ALL' },
                { label: 'Women', value: 'WOMAN' },
                { label: 'Men', value: 'MAN' },
                { label: 'Non-binary', value: 'NON_BINARY' },
              ]}
              onSelectOption={(val) => {
                haptics.selection();
                setGenderPref(val);
              }}
            />
          </SurfaceCard>

          {/* Premium Advanced Filters */}
          <PremiumGate
            feature="ADVANCED_DISCOVERY"
            lockedTitle="Relationship Intent Filters"
            lockedMessage="Filter your discovery deck by specific dating intentions, marriage goals, and lifestyle preferences with Nazar Premium."
            onUnlockPress={() =>
              router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/modal/filters')
            }
          >
            <SurfaceCard elevation="sm" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
                  <Icon name="sparkles" size="sm" color={theme.colors.accent} />
                </View>
                <Heading level="h3">Relationship Intent</Heading>
              </View>

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
                onSelectOption={(val) => {
                  haptics.selection();
                  setIntentPref(val as RelationshipIntent);
                }}
              />
              <View style={[styles.dealbreakerRow, { borderTopColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text level="bodySmall" weight="bold">
                      Dealbreaker
                    </Text>
                    {intentIsDealbreaker && <Badge variant="accent" label="Strict" size="sm" />}
                  </View>
                  <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                    Only show people with matching intention
                  </Text>
                </View>
                <Switch
                  value={intentIsDealbreaker}
                  onValueChange={(val) => {
                    haptics.selection();
                    setIntentIsDealbreaker(val);
                  }}
                  trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </SurfaceCard>

            <SurfaceCard elevation="sm" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
                  <Icon name="shield" size="sm" color={theme.colors.accent} />
                </View>
                <Heading level="h3">Family Plans</Heading>
              </View>

              <Select
                label=""
                value={familyPlans}
                options={[
                  { label: 'Want children', value: 'WANTS_CHILDREN' },
                  { label: "Don't want children", value: 'DONT_WANT_CHILDREN' },
                  { label: 'Open to children', value: 'OPEN_TO_CHILDREN' },
                  { label: 'Not sure yet', value: 'NOT_SURE' },
                ]}
                onSelectOption={(val) => {
                  haptics.selection();
                  setFamilyPlans(val as FamilyPlans);
                }}
              />
              <View style={[styles.dealbreakerRow, { borderTopColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text level="bodySmall" weight="bold">
                      Dealbreaker
                    </Text>
                    {familyPlansIsDealbreaker && (
                      <Badge variant="accent" label="Strict" size="sm" />
                    )}
                  </View>
                  <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                    Only show people with matching family plans
                  </Text>
                </View>
                <Switch
                  value={familyPlansIsDealbreaker}
                  onValueChange={(val) => {
                    haptics.selection();
                    setFamilyPlansIsDealbreaker(val);
                  }}
                  trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </SurfaceCard>
          </PremiumGate>

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
    padding: 18,
    borderRadius: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealbreakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  buttonWrapper: {
    marginTop: 12,
    marginBottom: 20,
  },
});
