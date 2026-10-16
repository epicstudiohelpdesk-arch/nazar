import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { InterestItem } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

// Canonical fallback taxonomy curated for authentic Indian nuances
const FALLBACK_INTERESTS: InterestItem[] = [
  { id: 'int_1', name: 'Filter Coffee ☕', slug: 'filter-coffee', category: 'Food & Drink' },
  { id: 'int_2', name: 'Hindustani Classical 🎵', slug: 'hindustani-classical', category: 'Music' },
  { id: 'int_3', name: 'Indie Cinema 🎬', slug: 'indie-cinema', category: 'Arts & Culture' },
  { id: 'int_4', name: 'Street Food & Chaat 🥟', slug: 'street-food', category: 'Food & Drink' },
  { id: 'int_5', name: 'Weekend Trekking ⛰️', slug: 'weekend-trekking', category: 'Outdoors' },
  { id: 'int_6', name: 'Modern Indian Art 🎨', slug: 'modern-art', category: 'Arts & Culture' },
  { id: 'int_7', name: 'Books & Literature 📚', slug: 'books-literature', category: 'Lifestyle' },
  { id: 'int_8', name: 'Cricket & IPL 🏏', slug: 'cricket', category: 'Sports' },
  { id: 'int_9', name: 'Board Games & Catan 🎲', slug: 'board-games', category: 'Lifestyle' },
  {
    id: 'int_10',
    name: 'Architecture & Heritage 🏛️',
    slug: 'architecture',
    category: 'Arts & Culture',
  },
  { id: 'int_11', name: 'Yoga & Mindfulness 🧘', slug: 'yoga-mindfulness', category: 'Wellness' },
  { id: 'int_12', name: 'Live Indie Gigs 🎸', slug: 'live-gigs', category: 'Music' },
  { id: 'int_13', name: 'Sufi & Ghazals 🎶', slug: 'sufi-ghazals', category: 'Music' },
  { id: 'int_14', name: 'Heritage Walks 🚶‍♂️', slug: 'heritage-walks', category: 'Outdoors' },
  {
    id: 'int_15',
    name: 'Home Cooking & Spices 🥘',
    slug: 'home-cooking',
    category: 'Food & Drink',
  },
  { id: 'int_16', name: 'Poetry & Shayari ✍️', slug: 'poetry-shayari', category: 'Arts & Culture' },
];

export default function OnboardingInterestsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  const { draftInterests, toggleDraftInterest } = useOnboardingStore();

  const [availableInterests, setAvailableInterests] = useState<InterestItem[]>(FALLBACK_INTERESTS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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

  const handleToggle = (id: string) => {
    const isSelected = draftInterests.includes(id);
    if (!isSelected && draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 interests.');
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

  const handleNext = async () => {
    if (draftInterests.length < 3) {
      haptics.notificationError();
      setErrorMessage('Please select at least 3 interests that represent you.');
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

  // Group available interests by category
  const categories = Array.from(
    new Set(availableInterests.map((item) => item.category || 'General'))
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />
      <ProgressBar progress={0.5} style={styles.progressBar} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text level="label" color="accent">
            STEP 3 OF 6
          </Text>
          <Heading level="h1">What are you into?</Heading>
          <Text level="body" color="secondary">
            Select 3 to 10 passions to help us curate profiles who share your rhythm.
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

        <View style={styles.categoriesContainer}>
          {categories.map((category) => {
            const items = availableInterests.filter((i) => (i.category || 'General') === category);

            return (
              <View key={category} style={styles.categorySection}>
                <Text
                  level="title"
                  style={[styles.categoryTitle, { color: theme.colors.textPrimary }]}
                >
                  {category}
                </Text>
                <View style={styles.chipRow}>
                  {items.map((item) => {
                    const isSelected = draftInterests.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleToggle(item.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.accent
                              : theme.colors.surfaceMuted,
                            borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                          },
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'not selected'}`}
                      >
                        <Text
                          level="bodySmall"
                          style={{
                            color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          }}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={draftInterests.length < 3}
            onPress={handleNext}
            accessibilityLabel={`Continue to prompts (${draftInterests.length} of 3 required selected)`}
          >
            {draftInterests.length < 3
              ? `Select at least 3 interests (${draftInterests.length}/3)`
              : `Continue (${draftInterests.length} Selected)`}
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
  categoriesContainer: {
    marginVertical: 20,
    gap: 20,
  },
  categorySection: {
    gap: 10,
  },
  categoryTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
