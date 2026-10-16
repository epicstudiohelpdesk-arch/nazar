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
import { Icon } from '../../src/design/primitives/Icon.js';
import { Badge } from '../../src/design/primitives/Badge.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';
import { getDefaultSafetyApi } from '../../src/safety/safety-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function SafetyReportModalRoute(): React.JSX.Element {
  const { targetId } = useLocalSearchParams<{ targetId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const safetyApi = getDefaultSafetyApi();

  const [reason, setReason] = useState<ReportReasonCode>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    haptics.medium();
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth || 540, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard elevation="sm" style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View style={[styles.shieldCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="shield" size="sm" color={theme.colors.accent} />
            </View>
            <Badge variant="accent" label="Confidential Safety Review" size="sm" />
          </View>
          <Heading level="h2" style={{ marginTop: 4 }}>Safety Report</Heading>
          <Text level="body" color="secondary" style={{ lineHeight: 22 }}>
            Your report is strictly confidential. The reported member will never know who filed this report.
          </Text>
        </SurfaceCard>

        <SurfaceCard elevation="sm" style={styles.formCard}>
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
            onSelectOption={(val) => {
              haptics.selection();
              setReason(val as ReportReasonCode);
            }}
          />

          <MultilineInput
            label="Additional details (optional)"
            placeholder="Help our moderation team understand the context..."
            value={details}
            onChangeText={setDetails}
            maxLength={300}
          />
        </SurfaceCard>

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
    gap: 16,
    paddingBottom: 40,
  },
  headerCard: {
    padding: 18,
    borderRadius: 20,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: 18,
    borderRadius: 20,
    gap: 16,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
