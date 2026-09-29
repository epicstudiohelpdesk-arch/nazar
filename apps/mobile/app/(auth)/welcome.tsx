import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Button } from '../../src/design/components/button/Button.js';
import { Icon } from '../../src/design/primitives/Icon.js';

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.brandHero}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
            <Icon name="sparkles" size={44} color={theme.colors.accent} />
          </View>
          <Heading level="display" style={styles.title}>
            Nazar
          </Heading>
          <Text level="bodyLarge" color="secondary" style={styles.tagline}>
            Authentic, modern Indian dating built for genuine connection.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/login')}
            accessibilityLabel="Get Started with phone or email"
          >
            Get Started
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/login')}
            accessibilityLabel="I already have an account, sign in"
          >
            Sign In
          </Button>

          <Text level="caption" color="tertiary" style={styles.legalNotice}>
            By signing up, you agree to our Terms of Service and Privacy Policy. You must be 18+ to join.
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
    maxWidth: 280,
    lineHeight: 24,
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
