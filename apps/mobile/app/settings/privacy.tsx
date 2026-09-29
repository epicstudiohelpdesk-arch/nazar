import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';

export default function PrivacySettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [showInDiscovery, setShowInDiscovery] = useState(true);
  const [approximateLocation, setApproximateLocation] = useState(true);
  const [incognitoMode, setIncognitoMode] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Privacy Controls"
        onBack={() => router.back()}
        leftAction="back"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Heading level="h3">Discovery Visibility</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Show Me on Nazar</Text>
                <Text level="bodySmall" color="secondary">
                  While turned off, your profile will not be shown in the discovery feed. Existing matches can still talk to you.
                </Text>
              </View>
              <Switch
                value={showInDiscovery}
                onValueChange={setShowInDiscovery}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Incognito / Ghost Mode</Text>
                <Text level="bodySmall" color="secondary">
                  Only be visible to people you have personally liked. (Nazar Gold Feature)
                </Text>
              </View>
              <Switch
                value={incognitoMode}
                onValueChange={setIncognitoMode}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <Heading level="h3">Location Privacy</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Approximate Neighborhood</Text>
                <Text level="bodySmall" color="secondary">
                  Display approximate distance and neighborhood rather than exact GPS metrics.
                </Text>
              </View>
              <Switch
                value={approximateLocation}
                onValueChange={setApproximateLocation}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>
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
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: 1,
  },
});
