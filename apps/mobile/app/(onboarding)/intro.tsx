import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function OnboardingIntroScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const handleStart = () => {
    trackOnboardingEvent('profile_started', { entryPoint: 'intro_begin' });
    router.push('/(onboarding)/profile-setup');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.accent,
                borderWidth: 1,
              },
            ]}
          >
            <Icon name="sparkles" size={32} color={theme.colors.accent} />
          </View>
          <Heading level="h1" style={styles.title}>
            Build your story on Nazar
          </Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Nazar is curated for intentional connection. Set up your profile in a few thoughtful
            steps.
          </Text>
        </View>

        <View style={styles.stepsList}>
          <SurfaceCard
            elevation="none"
            style={[styles.stepCard, { borderColor: theme.colors.border }]}
          >
            <View style={[styles.stepNumberBadge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text level="label" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                1
              </Text>
            </View>
            <View style={styles.stepText}>
              <Text level="title" style={{ color: theme.colors.textPrimary }}>
                The Basics
              </Text>
              <Text level="bodySmall" color="secondary">
                Your first name, age, city, and what relationship intent you are seeking.
              </Text>
            </View>
          </SurfaceCard>

          <SurfaceCard
            elevation="none"
            style={[styles.stepCard, { borderColor: theme.colors.border }]}
          >
            <View style={[styles.stepNumberBadge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text level="label" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                2
              </Text>
            </View>
            <View style={styles.stepText}>
              <Text level="title" style={{ color: theme.colors.textPrimary }}>
                Your Photos
              </Text>
              <Text level="bodySmall" color="secondary">
                At least 2 clear, authentic photos. Candid portraits and real moments work best.
              </Text>
            </View>
          </SurfaceCard>

          <SurfaceCard
            elevation="none"
            style={[styles.stepCard, { borderColor: theme.colors.border }]}
          >
            <View style={[styles.stepNumberBadge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text level="label" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                3
              </Text>
            </View>
            <View style={styles.stepText}>
              <Text level="title" style={{ color: theme.colors.textPrimary }}>
                Interests & Prompts
              </Text>
              <Text level="bodySmall" color="secondary">
                Passions, cultural affinities, and questions that spark genuine conversations.
              </Text>
            </View>
          </SurfaceCard>

          <SurfaceCard
            elevation="none"
            style={[styles.stepCard, { borderColor: theme.colors.border }]}
          >
            <View style={[styles.stepNumberBadge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text level="label" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                4
              </Text>
            </View>
            <View style={styles.stepText}>
              <Text level="title" style={{ color: theme.colors.textPrimary }}>
                Discovery Preferences
              </Text>
              <Text level="bodySmall" color="secondary">
                Age range, distance boundaries, and who you are excited to discover.
              </Text>
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleStart}
            accessibilityLabel="Let's Begin Profile Creation"
          >
            Let's Begin ✨
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
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 8,
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  stepsList: {
    marginVertical: 28,
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
  },
  stepNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 4,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
