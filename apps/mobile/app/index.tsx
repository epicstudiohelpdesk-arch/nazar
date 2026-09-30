import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/design/theme/ThemeContext.js';
import { Heading } from '../src/design/primitives/Heading.js';
import { Text } from '../src/design/primitives/Text.js';
import { Icon } from '../src/design/primitives/Icon.js';
import { Button } from '../src/design/components/button/Button.js';
import { getDefaultSessionService } from '../src/auth/session-service.js';
import { trackOnboardingEvent } from '../src/analytics/onboarding-analytics.js';

export default function AppLaunchScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const sessionService = getDefaultSessionService();

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [showQAMenu, setShowQAMenu] = useState(false);

  const bootstrapApp = async () => {
    setIsBootstrapping(true);
    setOfflineError(null);

    try {
      const result = await sessionService.restoreSession();

      if (result.status === 'ACTIVE') {
        trackOnboardingEvent('discovery_entered', { source: 'cold_launch_active' });
        router.replace('/(tabs)/discovery');
        return;
      }

      if (result.status === 'INCOMPLETE') {
        const targetStep = result.nextStep || 'intro';
        const stepRoutes: Record<string, `/(onboarding)/${string}`> = {
          'profile-setup': '/(onboarding)/profile-setup',
          'photos': '/(onboarding)/photos',
          'interests': '/(onboarding)/interests',
          'prompts': '/(onboarding)/prompts',
          'preferences': '/(onboarding)/preferences',
          'permissions': '/(onboarding)/permissions',
          'preview': '/(onboarding)/preview',
        };
        const route = stepRoutes[targetStep] || '/(onboarding)/intro';
        router.replace(route);
        return;
      }

      if (result.status === 'PAUSED') {
        // Active session with paused profile -> go to discovery or profile
        router.replace('/(tabs)/discovery');
        return;
      }

      if (result.status === 'OFFLINE') {
        setOfflineError(result.error || 'Network offline. Tap retry to connect.');
        setIsBootstrapping(false);
        return;
      }

      // UNAUTHENTICATED or EXPIRED
      router.replace('/(auth)/welcome');
    } catch {
      // In case of unhandled bootstrap exception, default to welcome
      router.replace('/(auth)/welcome');
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    void bootstrapApp();
  }, []);

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
            <Icon name="sparkles" size={48} color={theme.colors.accent} />
          </View>
          <Heading level="display" style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>
            Nazar
          </Heading>
          <Text level="body" color="secondary" style={styles.tagline}>
            Authentic, intentional Indian connection
          </Text>

          {isBootstrapping && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text level="caption" color="tertiary" style={{ marginTop: 8 }}>
                Restoring session...
              </Text>
            </View>
          )}

          {offlineError && (
            <View style={styles.errorContainer}>
              <Text level="bodySmall" style={{ color: theme.colors.warning, textAlign: 'center' }}>
                {offlineError}
              </Text>
              <Button
                variant="secondary"
                size="md"
                onPress={bootstrapApp}
                accessibilityLabel="Retry connecting to server"
                style={{ marginTop: 12 }}
              >
                Retry Connection
              </Button>
              <Button
                variant="tertiary"
                size="sm"
                onPress={() => router.replace('/(auth)/welcome')}
                accessibilityLabel="Continue to welcome screen"
                style={{ marginTop: 8 }}
              >
                Continue Offline
              </Button>
            </View>
          )}
        </View>

        {/* Developer / QA Showcase Access */}
        <View style={styles.qaFooter}>
          <TouchableOpacity
            onPress={() => setShowQAMenu(!showQAMenu)}
            accessibilityRole="button"
            accessibilityLabel="Toggle developer navigation links"
          >
            <Text level="caption" color="tertiary">
              Nazar v1.0.0 • {showQAMenu ? 'Hide Dev Menu' : 'Dev Links'}
            </Text>
          </TouchableOpacity>

          {showQAMenu && (
            <View style={styles.qaLinks}>
              <TouchableOpacity
                onPress={() => router.push('/design-system-showcase')}
                style={styles.qaLink}
              >
                <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  🎨 Design System Showcase
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/welcome')}
                style={styles.qaLink}
              >
                <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  🚀 Welcome Screen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(onboarding)/intro')}
                style={styles.qaLink}
              >
                <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  📝 Onboarding Intro
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/discovery')}
                style={styles.qaLink}
              >
                <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  ✨ Discovery Tab
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  tagline: {
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
  loaderContainer: {
    marginTop: 28,
    alignItems: 'center',
  },
  errorContainer: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
    maxWidth: 300,
  },
  qaFooter: {
    alignItems: 'center',
    gap: 8,
  },
  qaLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  qaLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
