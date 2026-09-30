import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { ProfileCard, type ProfileCardData } from '../../src/design/components/card/ProfileCard.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function OnboardingPreviewScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const profileApi = getDefaultProfileApi();

  const { draftProfile, draftPhotos, draftInterests, draftPrompts } = useOnboardingStore();

  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Calculate age
  const calculateAge = (dobString?: string): number => {
    if (!dobString) return 24;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age > 0 ? age : 24;
  };

  // Sort photos so primary is first
  const sortedPhotos = [...draftPhotos].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  const photoUrls = sortedPhotos.map((p) => p.url);
  const primaryUrl =
    photoUrls[0] ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';

  const previewData: ProfileCardData = {
    id: 'preview-me',
    name: draftProfile.displayName || 'You',
    age: calculateAge(draftProfile.dateOfBirth),
    city: draftProfile.city || 'Mumbai',
    occupation: draftProfile.occupation || undefined,
    education: draftProfile.education || undefined,
    bio: draftProfile.bio || undefined,
    imageUrl: primaryUrl,
    images: photoUrls.length > 0 ? photoUrls : [primaryUrl],
    isVerified: true,
    interests: draftInterests.map((id) => id.replace('int_', '').replace('-', ' ')),
    prompts: draftPrompts.map((p) => ({
      question: p.prompt,
      answer: p.answer,
    })),
  };

  const handleActivate = async () => {
    setIsActivating(true);
    setErrorMessage(undefined);

    try {
      await profileApi.activateProfile();
      trackOnboardingEvent('onboarding_completed');
      trackOnboardingEvent('discovery_entered', { source: 'onboarding_completion' });
      router.replace('/(tabs)/discovery');
    } catch {
      // Local fallback in offline mode
      trackOnboardingEvent('onboarding_completed');
      trackOnboardingEvent('discovery_entered', { source: 'onboarding_completion_offline' });
      router.replace('/(tabs)/discovery');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={1.0} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text level="label" color="accent">
            FINAL REVIEW
          </Text>
          <Heading level="h1">Review your profile</Heading>
          <Text level="body" color="secondary">
            Here is how your profile will appear on Nazar discovery.
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

        {/* Profile Card Preview */}
        <View style={styles.cardWrapper}>
          <ProfileCard
            profile={previewData}
            context="profilePreview"
          />
        </View>

        {/* Quick Edit Links */}
        <View style={styles.editPillsRow}>
          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/(onboarding)/profile-setup')}
            accessibilityRole="button"
            accessibilityLabel="Edit basic details"
          >
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              ✏️ Edit Basics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/(onboarding)/photos')}
            accessibilityRole="button"
            accessibilityLabel="Edit photos"
          >
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              📷 Edit Photos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => router.push('/(onboarding)/prompts')}
            accessibilityRole="button"
            accessibilityLabel="Edit prompts"
          >
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              💬 Edit Prompts
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isActivating}
            onPress={handleActivate}
            accessibilityLabel="Activate profile and enter Nazar discovery"
          >
            Enter Nazar ✨
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 4,
  },
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardWrapper: {
    marginVertical: 20,
    alignItems: 'center',
  },
  editPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  editPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  buttonWrapper: {
    width: '100%',
  },
});
