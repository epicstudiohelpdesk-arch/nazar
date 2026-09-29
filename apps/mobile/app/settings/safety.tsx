import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';

export default function SafetyHubRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Safety & Trust"
        onBack={() => router.back()}
        leftAction="back"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Heading level="h3">Safety Toolkit</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.itemRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="shield" size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.itemText}>
                <Text level="title">Photo Verification</Text>
                <Text level="bodySmall" color="secondary">
                  Your profile is photo-verified. You will see a green checkmark next to your name.
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.itemRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Icon name="flag" size={20} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.itemText}>
                <Text level="title">Blocked Accounts</Text>
                <Text level="bodySmall" color="secondary">
                  0 blocked users. Blocked accounts cannot see your profile or send messages.
                </Text>
              </View>
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <Heading level="h3">Meeting in Person: Safe Dating Rules</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <Text level="body" color="primary">
              1. Always meet in a well-lit, public location (café, gallery, or restaurant).
            </Text>
            <Text level="body" color="primary">
              2. Tell a trusted friend or family member where you're going and who you're meeting.
            </Text>
            <Text level="body" color="primary">
              3. Stay in control of your transportation—never rely on a first date for a ride home.
            </Text>
            <Text level="body" color="primary">
              4. Never send financial assistance, crypto, or wire transfers to anyone met online.
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
  divider: {
    height: 1,
  },
});
