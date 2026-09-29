import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Avatar } from '../../src/design/primitives/Avatar.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';

export default function MatchCelebrationModalRoute(): React.JSX.Element {
  const { matchId, conversationId, userName } = useLocalSearchParams<{
    matchId?: string;
    conversationId?: string;
    userName?: string;
  }>();
  const router = useRouter();
  const { theme } = useTheme();

  const handleStartChat = () => {
    const targetChat = conversationId || matchId || 'conv-new';
    router.replace(`/chat/${targetChat}`);
  };

  const handleKeepBrowsing = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backdrop} />
      <SurfaceCard elevation="lg" style={[styles.dialog, { backgroundColor: theme.colors.surfaceElevated }]}>
        <View style={styles.celebrationBadge}>
          <Text level="display">💕</Text>
        </View>

        <Heading level="h1" style={styles.title}>
          It's a Match!
        </Heading>
        <Text level="body" color="secondary" style={styles.subtitle}>
          You and {userName || 'each other'} liked each other's profiles.
        </Text>

        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: theme.colors.accent }]}>
            <Avatar
              size="large"
              uri="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500"
              name="Me"
            />
          </View>
          <View style={[styles.avatarRing, { borderColor: theme.colors.accent, marginLeft: -16 }]}>
            <Avatar
              size="large"
              uri="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500"
              name={userName || 'Match'}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleStartChat}
            accessibilityLabel="Start chat conversation"
          >
            Say Hello 💌
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={handleKeepBrowsing}
            accessibilityLabel="Keep browsing discovery"
          >
            Keep Browsing
          </Button>
        </View>
      </SurfaceCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  celebrationBadge: {
    marginBottom: -4,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarRow: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  avatarRing: {
    borderWidth: 3,
    borderRadius: 999,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
});
