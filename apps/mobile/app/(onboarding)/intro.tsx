import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon, type IconName } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

interface StepDef {
  number: number;
  icon: IconName;
  title: string;
  desc: string;
}

const ONBOARDING_STEPS: StepDef[] = [
  {
    number: 1,
    icon: 'user',
    title: 'The Basics',
    desc: 'Your first name, age, city, and relationship intent.',
  },
  {
    number: 2,
    icon: 'camera',
    title: 'Your Photos',
    desc: 'At least 2 clear, authentic portraits. Candid moments work best.',
  },
  {
    number: 3,
    icon: 'sparkles',
    title: 'Interests & Prompts',
    desc: 'Passions, cultural affinities, and questions that spark genuine conversations.',
  },
  {
    number: 4,
    icon: 'compass',
    title: 'Discovery Preferences',
    desc: 'Age range, distance boundaries, and who you are excited to discover.',
  },
];

export default function OnboardingIntroScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  const handleStart = () => {
    haptics.impactMedium();
    trackOnboardingEvent('profile_started', { entryPoint: 'intro_begin' });
    router.push('/(onboarding)/profile-setup');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="" onBack={() => router.back()} leftAction="back" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
            <Icon name="sparkles" size={28} color={theme.colors.accent} />
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
          {ONBOARDING_STEPS.map((step) => (
            <SurfaceCard
              key={step.number}
              elevation="none"
              style={[styles.stepCard, { borderColor: theme.colors.border }]}
            >
              <View style={[styles.stepNumberBadge, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name={step.icon} size="sm" color={theme.colors.accent} />
              </View>
              <View style={styles.stepText}>
                <View style={styles.stepTitleRow}>
                  <Text level="label" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                    STEP {step.number}
                  </Text>
                  <Text level="title" style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
                    {step.title}
                  </Text>
                </View>
                <Text level="bodySmall" color="secondary" style={{ lineHeight: 18 }}>
                  {step.desc}
                </Text>
              </View>
            </SurfaceCard>
          ))}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleStart}
            accessibilityLabel="Begin Profile Creation"
          >
            Begin Profile Creation
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
  stepTitleRow: {
    gap: 2,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
