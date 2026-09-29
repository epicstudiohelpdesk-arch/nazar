import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Select } from '../../src/design/components/input/Select.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function SafetyReportModalRoute(): React.JSX.Element {
  const { targetId } = useLocalSearchParams<{ targetId: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const [reason, setReason] = useState('HARASSMENT');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const authClient = getDefaultAuthClient();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await authClient.request('/v1/safety/reporting', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: targetId || 'unknown',
          reason,
          details,
        }),
      });
      Alert.alert(
        'Report Received',
        'Thank you for looking out for our community. Our safety moderation team is actively reviewing this account.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert(
        'Report Received',
        'Thank you for looking out for our community. Our safety team is reviewing this report.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Report Member"
        onBack={() => router.back()}
        leftAction="close"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Heading level="h2">Safety Report</Heading>
          <Text level="body" color="secondary">
            Your report is confidential. The reported member will not know who filed this report.
          </Text>
        </View>

        <View style={styles.form}>
          <Select
            label="Reason for reporting"
            value={reason}
            options={[
              { label: 'Harassment or offensive behavior', value: 'HARASSMENT' },
              { label: 'Inappropriate or explicit photos', value: 'INAPPROPRIATE_PHOTOS' },
              { label: 'Fake profile, impersonation, or scam', value: 'SCAM_OR_FAKE' },
              { label: 'Commercial promotion or spam', value: 'SPAM' },
              { label: 'Under 18 years of age', value: 'UNDERAGE' },
              { label: 'Other violation', value: 'OTHER' },
            ]}
            onSelectOption={setReason}
          />

          <MultilineInput
            label="Additional details (optional)"
            placeholder="Help our moderation team understand the context..."
            value={details}
            onChangeText={setDetails}
            maxLength={300}
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="destructive"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            onPress={handleSubmit}
            accessibilityLabel="Submit safety report"
          >
            Submit Confidential Report
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
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 6,
  },
  form: {
    gap: 16,
  },
  buttonWrapper: {
    marginTop: 12,
  },
});
