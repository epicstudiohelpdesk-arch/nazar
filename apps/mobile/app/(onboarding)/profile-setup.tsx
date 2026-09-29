import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { DateSelector } from '../../src/design/components/input/DateSelector.js';
import { Select } from '../../src/design/components/input/Select.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';

export default function OnboardingProfileSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState('WOMAN');
  const [intent, setIntent] = useState('LONG_TERM');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleNext = () => {
    if (!displayName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!dateOfBirth) {
      setErrorMessage('Please select your date of birth.');
      return;
    }

    // Age check: must be 18+
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    if (age < 18) {
      setErrorMessage('You must be at least 18 years old to join Nazar.');
      return;
    }

    setErrorMessage(undefined);
    router.push('/(onboarding)/photos');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={0.2} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text level="label" color="accent">STEP 1 OF 5</Text>
          <Heading level="h1">The Basics</Heading>
          <Text level="body" color="secondary">
            Tell us about yourself. Your age will be displayed on your profile.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="First Name"
            placeholder="e.g. Priya"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              if (errorMessage) setErrorMessage(undefined);
            }}
            errorMessage={errorMessage}
          />

          <DateSelector
            label="Date of Birth"
            value={dateOfBirth}
            onChangeDate={(date) => {
              setDateOfBirth(date);
              if (errorMessage) setErrorMessage(undefined);
            }}
            helperText="You must be at least 18 years old"
          />

          <Select
            label="Gender"
            value={gender}
            options={[
              { label: 'Woman', value: 'WOMAN' },
              { label: 'Man', value: 'MAN' },
              { label: 'Non-binary', value: 'NON_BINARY' },
            ]}
            onSelectOption={setGender}
          />

          <Select
            label="Relationship Intent"
            value={intent}
            options={[
              { label: 'Marriage / Long-term relationship', value: 'LONG_TERM' },
              { label: 'Dating with intention', value: 'INTENTIONAL_DATING' },
              { label: 'Open to possibilities', value: 'OPEN' },
            ]}
            onSelectOption={setIntent}
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
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
    paddingBottom: 32,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  form: {
    marginVertical: 24,
    gap: 16,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
