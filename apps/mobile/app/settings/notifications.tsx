import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';

export default function NotificationSettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [newMatches, setNewMatches] = useState(true);
  const [messages, setMessages] = useState(true);
  const [likesReceived, setLikesReceived] = useState(true);
  const [events, setEvents] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Notification Preferences"
        onBack={() => router.back()}
        leftAction="back"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Heading level="h3">Push Notifications</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">New Matches</Text>
                <Text level="bodySmall" color="secondary">
                  Notify me when someone mutually matches with me.
                </Text>
              </View>
              <Switch
                value={newMatches}
                onValueChange={setNewMatches}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Chat Messages</Text>
                <Text level="bodySmall" color="secondary">
                  Notify me when a match sends me a message.
                </Text>
              </View>
              <Switch
                value={messages}
                onValueChange={setMessages}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Likes Received</Text>
                <Text level="bodySmall" color="secondary">
                  Notify me when new people like my profile.
                </Text>
              </View>
              <Switch
                value={likesReceived}
                onValueChange={setLikesReceived}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Singles Events & Mixers</Text>
                <Text level="bodySmall" color="secondary">
                  Notify me about upcoming cultural events in my city.
                </Text>
              </View>
              <Switch
                value={events}
                onValueChange={setEvents}
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
