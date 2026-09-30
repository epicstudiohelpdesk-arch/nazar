import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Avatar } from '../../src/design/primitives/Avatar.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { useProfileStore } from '../../src/profile/profile-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function MatchCelebrationModalRoute(): React.JSX.Element {
  const { matchId, conversationId, targetUserId, userName, userAvatar } = useLocalSearchParams<{
    matchId?: string;
    conversationId?: string;
    targetUserId?: string;
    userName?: string;
    userAvatar?: string;
  }>();
  const router = useRouter();
  const { theme } = useTheme();

  const profileStore = useProfileStore();
  const myAvatar =
    profileStore.media.find((m) => m.isPrimary)?.url ||
    profileStore.media[0]?.url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
  const myName = profileStore.profile?.displayName || 'You';

  const matchedAvatar =
    userAvatar || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500';
  const matchedName = userName ? decodeURIComponent(userName) : 'Your Match';

  useEffect(() => {
    trackOnboardingEvent('match_celebration_viewed', {
      matchId: matchId || 'unknown',
      targetUserId: targetUserId || undefined,
    });
  }, [matchId, targetUserId]);

  const handleStartChat = () => {
    const targetChat = conversationId || matchId;
    if (targetChat) {
      router.replace(`/chat/${targetChat}`);
    } else {
      router.replace('/(tabs)/matches');
    }
  };

  const handleKeepBrowsing = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backdrop} />
      <SurfaceCard
        elevation="lg"
        style={[styles.dialog, { backgroundColor: theme.colors.surfaceElevated }]}
      >
        <View style={styles.celebrationBadge}>
          <Text level="display">💕</Text>
        </View>

        <Heading level="h1" style={styles.title}>
          It's a Match!
        </Heading>
        <Text level="body" color="secondary" style={styles.subtitle}>
          You and {matchedName} liked each other's profiles.
        </Text>

        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: theme.colors.accent }]}>
            <Avatar size="large" uri={myAvatar} name={myName} />
          </View>
          <View style={[styles.avatarRing, { borderColor: theme.colors.accent, marginLeft: -16 }]}>
            <Avatar size="large" uri={matchedAvatar} name={matchedName} />
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
