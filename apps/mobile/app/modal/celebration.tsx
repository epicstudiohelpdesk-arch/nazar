import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Avatar } from '../../src/design/primitives/Avatar.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { useProfileStore } from '../../src/profile/profile-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { haptics } from '../../src/design/haptics/index.js';
import { announceAccessibility } from '../../src/design/a11y/index.js';
import { useReducedMotion } from '../../src/design/motion/index.js';

import { Icon } from '../../src/design/primitives/Icon.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';

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
  const isReduced = useReducedMotion();
  const { isSmallScreen } = useResponsiveLayout();

  const scaleAnim = useRef(new Animated.Value(isReduced ? 1 : 0.88)).current;
  const fadeAnim = useRef(new Animated.Value(isReduced ? 1 : 0)).current;

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

    haptics.success();
    announceAccessibility(`It's a Match! You and ${matchedName} liked each other's profiles.`);

    if (!isReduced) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [matchId, targetUserId, matchedName, isReduced, scaleAnim, fadeAnim]);

  const handleStartChat = () => {
    haptics.medium();
    const targetChat = conversationId || matchId;
    if (targetChat) {
      router.replace(`/chat/${targetChat}`);
    } else {
      router.replace('/(tabs)/matches');
    }
  };

  const handleKeepBrowsing = () => {
    haptics.light();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backdrop} />
      <Animated.View
        style={{
          width: '100%',
          alignItems: 'center',
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        }}
      >
        <SurfaceCard
          elevation="lg"
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              maxWidth: isSmallScreen ? 320 : 360,
            },
          ]}
        >
          <View
            style={[
              styles.celebrationBadge,
              { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
            ]}
          >
            <Icon name="heart" size="lg" color={theme.colors.accent} fill={theme.colors.accent} />
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
            <View
              style={[styles.avatarRing, { borderColor: theme.colors.accent, marginLeft: -16 }]}
            >
              <Avatar size="large" uri={matchedAvatar} name={matchedName} />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleStartChat}
              accessibilityLabel={`Say hello and message ${matchedName}`}
            >
              Say Hello
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={handleKeepBrowsing}
              accessibilityLabel="Keep browsing discovery profiles"
            >
              Keep Browsing
            </Button>
          </View>
        </SurfaceCard>
      </Animated.View>
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
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
