import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Button } from '../../src/design/components/button/Button.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const handleGetStarted = () => {
    trackOnboardingEvent('onboarding_started', { entryPoint: 'get_started' });
    router.push('/(auth)/login');
  };

  const handleSignIn = () => {
    trackOnboardingEvent('onboarding_started', { entryPoint: 'sign_in' });
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.brandHero}>
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
            <Icon name="sparkles" size={44} color={theme.colors.accent} />
          </View>
          <Heading level="display" style={[styles.title, { color: theme.colors.textPrimary }]}>
            Nazar
          </Heading>
          <Text level="bodyLarge" color="secondary" style={styles.tagline}>
            Meaningful connections, rooted in culture and authentic intent.
          </Text>

          <View style={styles.featurePills}>
            <View
              style={[
                styles.featurePill,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}
            >
              <Text level="caption" style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>
                Verified Profiles
              </Text>
            </View>
            <View
              style={[
                styles.featurePill,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}
            >
              <Text level="caption" style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>
                Intentional Dating
              </Text>
            </View>
            <View
              style={[
                styles.featurePill,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}
            >
              <Text level="caption" style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>
                Zero Noise
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleGetStarted}
            accessibilityLabel="Get Started with phone or email"
          >
            Get Started
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={handleSignIn}
            accessibilityLabel="I already have an account, sign in"
          >
            Sign In
          </Button>

          <Text level="caption" color="tertiary" style={styles.legalNotice}>
            By continuing, you agree to Nazar's Terms of Service and Privacy Policy. You must be 18+ to join.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  brandHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 24,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  featurePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  legalNotice: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
