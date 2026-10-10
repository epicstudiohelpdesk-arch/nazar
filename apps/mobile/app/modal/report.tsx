import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReportReasonCode } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Select } from '../../src/design/components/input/Select.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultSafetyApi } from '../../src/safety/safety-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function SafetyReportModalRoute(): React.JSX.Element {
  const { targetId } = useLocalSearchParams<{ targetId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const safetyApi = getDefaultSafetyApi();

  const [reason, setReason] = useState<ReportReasonCode>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await safetyApi.createReport({
        targetType: 'USER',
        targetId: targetId || 'unknown',
        reasonCode: reason,
        description: details.trim() || undefined,
      });

      trackOnboardingEvent('report_submitted', {
        targetId: targetId || 'unknown',
        reason,
      });

      Alert.alert(
        'Report Received',
        'Thank you for looking out for our community. Our safety moderation team is actively reviewing this account.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to submit report';
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Report Member" onBack={() => router.back()} leftAction="close" />
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
              { label: 'Inappropriate or explicit photos', value: 'INAPPROPRIATE_CONTENT' },
              { label: 'Fake profile, impersonation, or bot', value: 'FAKE_PROFILE' },
              { label: 'Commercial promotion or spam', value: 'SPAM' },
              { label: 'Scam, phishing, or financial fraud', value: 'SCAM_OR_FRAUD' },
              { label: 'Under 18 years of age', value: 'MINOR_SAFETY_CONCERN' },
              { label: 'Other violation', value: 'OTHER' },
            ]}
            onSelectOption={(val) => setReason(val as ReportReasonCode)}
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
