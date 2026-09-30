import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultSafetyApi, SAFETY_QUERY_KEYS } from '../../src/safety/safety-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function SafetyHubRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const safetyApi = getDefaultSafetyApi();

  const blocksQuery = useQuery({
    queryKey: SAFETY_QUERY_KEYS.blocks,
    queryFn: () => safetyApi.getBlockedUsers(),
  });

  useEffect(() => {
    trackOnboardingEvent('safety_viewed');
  }, []);

  const blockedCount = blocksQuery.data?.items?.length ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Safety & Trust" onBack={() => router.back()} leftAction="back" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Safety Controls & Blocked Accounts */}
        <View style={styles.section}>
          <Heading level="h3">Safety Controls</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => router.push('/settings/blocked')}
              accessibilityRole="button"
              accessibilityLabel="Manage blocked users"
            >
              <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Icon name="flag" size={20} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.itemText}>
                <Text level="title">Blocked Accounts ({blockedCount})</Text>
                <Text level="bodySmall" color="secondary">
                  {blockedCount === 0
                    ? 'No blocked accounts. Manage users you have blocked.'
                    : `${blockedCount} user${blockedCount > 1 ? 's' : ''} blocked from contacting you.`}
                </Text>
              </View>
              <Icon name="chevron" size={18} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.itemRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="shield" size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.itemText}>
                <Text level="title">Photo Verification</Text>
                <Text level="bodySmall" color="secondary">
                  Your profile photos are verified through biometric selfie confirmation.
                </Text>
              </View>
            </View>
          </SurfaceCard>
        </View>

        {/* Meeting in Person: Safe Dating Rules */}
        <View style={styles.section}>
          <Heading level="h3">Safe Dating Rules</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.guidelineItem}>
              <Text level="title" color="accent">1. Always Meet in Public</Text>
              <Text level="bodySmall" color="secondary">
                Choose a populated, well-lit café, restaurant, or public gallery for your first few meetings. Never meet at a private residence or secluded location.
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.guidelineItem}>
              <Text level="title" color="accent">2. Inform a Friend or Family Member</Text>
              <Text level="bodySmall" color="secondary">
                Share your date itinerary, location, and the person’s profile details with someone you trust before meeting.
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.guidelineItem}>
              <Text level="title" color="accent">3. Own Your Transportation</Text>
              <Text level="bodySmall" color="secondary">
                Arrange your own ride to and from the venue. Avoid relying on your date for transportation so you can leave whenever you feel uncomfortable.
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.guidelineItem}>
              <Text level="title" color="accent">4. Zero Tolerance for Financial Solicitations</Text>
              <Text level="bodySmall" color="secondary">
                Never send money, wire transfers, crypto, or financial credentials to anyone you meet online. Report any financial requests immediately.
              </Text>
            </View>
          </SurfaceCard>
        </View>

        {/* Community Standards & Reporting */}
        <View style={styles.section}>
          <Heading level="h3">Zero Tolerance Policy</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <Text level="body" color="primary">
              Nazar strictly enforces zero tolerance against harassment, hate speech, impersonation, non-consensual content, and solicitation.
            </Text>
            <Text level="bodySmall" color="secondary">
              Reports submitted in-app are reviewed with high priority. Offending accounts are permanently banned and device-blacklisted.
            </Text>
          </SurfaceCard>
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
    gap: 24,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  guidelineItem: {
    gap: 4,
  },
  divider: {
    height: 1,
  },
});
