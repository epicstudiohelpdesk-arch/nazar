import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { DateSelector } from '../../src/design/components/input/DateSelector.js';
import { Select } from '../../src/design/components/input/Select.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

const GENDER_OPTIONS = [
  { label: 'Woman', value: 'WOMAN' },
  { label: 'Man', value: 'MAN' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Other', value: 'OTHER' },
];

const INTENT_OPTIONS = [
  { label: 'Long-term relationship / Marriage', value: 'LONG_TERM' },
  { label: 'Dating with intention', value: 'SHORT_TERM' },
  { label: 'Casual dating & exploring', value: 'CASUAL' },
  { label: 'New friends & community', value: 'FRIENDSHIP' },
  { label: 'Still figuring it out', value: 'NOT_SURE' },
];

const POPULAR_CITIES = [
  'Mumbai',
  'Bengaluru',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Kolkata',
  'Chennai',
];

export default function OnboardingProfileSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  const { draftProfile, updateDraftProfile } = useOnboardingStore();

  const [displayName, setDisplayName] = useState(draftProfile.displayName);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    draftProfile.dateOfBirth ? new Date(draftProfile.dateOfBirth) : null
  );
  const [gender, setGender] = useState<Gender>(draftProfile.gender || 'WOMAN');
  const [intent, setIntent] = useState<RelationshipIntent>(draftProfile.intent || 'LONG_TERM');
  const [city, setCity] = useState(draftProfile.city || '');
  const [bio, setBio] = useState(draftProfile.bio || '');
  const [occupation, setOccupation] = useState(draftProfile.occupation || '');
  const [education, setEducation] = useState(draftProfile.education || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleNext = async () => {
    if (!displayName.trim()) {
      haptics.notificationError();
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (displayName.trim().length > 30) {
      haptics.notificationError();
      setErrorMessage('First name cannot exceed 30 characters.');
      return;
    }
    if (!dateOfBirth) {
      haptics.notificationError();
      setErrorMessage('Please select your date of birth.');
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age < 18) {
      haptics.notificationError();
      setErrorMessage('You must be at least 18 years old to join Nazar.');
      return;
    }
    if (age > 100) {
      haptics.notificationError();
      setErrorMessage('Please enter a valid date of birth.');
      return;
    }

    if (!city.trim()) {
      haptics.notificationError();
      setErrorMessage('Please provide your current city.');
      return;
    }

    haptics.impactMedium();
    const formattedDob = dateOfBirth.toISOString().split('T')[0];

    // Preserve in store draft
    updateDraftProfile({
      displayName: displayName.trim(),
      dateOfBirth: formattedDob,
      gender,
      intent,
      city: city.trim(),
      bio: bio.trim(),
      occupation: occupation.trim(),
      education: education.trim(),
    });

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      await profileApi.updateMyProfile({
        displayName: displayName.trim(),
        dateOfBirth: formattedDob,
        gender,
        city: city.trim(),
        bio: bio.trim() || undefined,
        occupation: occupation.trim() || undefined,
        education: education.trim() || undefined,
      });

      trackOnboardingEvent('profile_details_completed', {
        age,
        gender,
        intent,
      });

      router.push('/(onboarding)/photos');
    } catch (err: unknown) {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Failed to save profile. Tap Continue to retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />
      <ProgressBar progress={0.15} style={styles.progressBar} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text level="label" color="accent">
            STEP 1 OF 6
          </Text>
          <Heading level="h1">The Basics</Heading>
          <Text level="body" color="secondary">
            Your name, age, and city will be shown on your profile.
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

        <View style={styles.form}>
          <TextInput
            label="First Name"
            placeholder="e.g. Anya"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              if (errorMessage) setErrorMessage(undefined);
            }}
            maxLength={30}
            testID="name-input"
          />

          <DateSelector
            label="Date of Birth"
            value={dateOfBirth}
            onChangeDate={(date) => {
              setDateOfBirth(date);
              if (errorMessage) setErrorMessage(undefined);
            }}
            helperText={
              dateOfBirth
                ? `Age: ${calculateAge(dateOfBirth)} years old (Must be 18+)`
                : 'You must be at least 18 years old'
            }
          />

          <Select
            label="Gender Identity"
            value={gender}
            options={GENDER_OPTIONS}
            onSelectOption={(val) => {
              haptics.selection();
              setGender(val as Gender);
            }}
          />

          <Select
            label="Relationship Intent"
            value={intent}
            options={INTENT_OPTIONS}
            onSelectOption={(val) => {
              haptics.selection();
              setIntent(val as RelationshipIntent);
            }}
          />

          <View>
            <TextInput
              label="Current City"
              placeholder="e.g. Mumbai, Bengaluru"
              value={city}
              onChangeText={(t) => {
                setCity(t);
                if (errorMessage) setErrorMessage(undefined);
              }}
              testID="city-input"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cityPills}
            >
              {POPULAR_CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => {
                    haptics.selection();
                    setCity(c);
                  }}
                  style={[
                    styles.cityPill,
                    {
                      backgroundColor:
                        city === c ? theme.colors.accentSoft : theme.colors.surfaceMuted,
                      borderColor: city === c ? theme.colors.accent : theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select city ${c}`}
                >
                  <Text
                    level="caption"
                    style={{
                      color: city === c ? theme.colors.accentStrong : theme.colors.textSecondary,
                      fontWeight: city === c ? '700' : '500',
                    }}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <MultilineInput
            label={`Bio (${bio.length}/300)`}
            placeholder="A little about your rhythm, weekend rituals, and what brings you joy..."
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, 300))}
            maxLength={300}
          />

          <TextInput
            label="Occupation (Optional)"
            placeholder="e.g. Architect, Product Designer"
            value={occupation}
            onChangeText={setOccupation}
          />

          <TextInput
            label="Education (Optional)"
            placeholder="e.g. NID, IIT Bombay"
            value={education}
            onChangeText={setEducation}
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            onPress={handleNext}
            accessibilityLabel="Continue to photo upload"
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
  form: {
    marginVertical: 20,
    gap: 16,
  },
  cityPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
