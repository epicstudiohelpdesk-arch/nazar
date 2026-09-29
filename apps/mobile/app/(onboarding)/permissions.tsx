import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { ProgressBar } from '../../src/design/components/feedback/ProgressBar.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function OnboardingPermissionsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const [isActivating, setIsActivating] = useState(false);
  const authClient = getDefaultAuthClient();

  const handleFinish = async () => {
    setIsActivating(true);
    try {
      await authClient.request('/v1/profiles/me/activate', { method: 'POST' });
      router.replace('/(tabs)/discovery');
    } catch {
      // In dev/mock fallback: proceed to discovery
      router.replace('/(tabs)/discovery');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />
      <ProgressBar progress={1.0} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text level="label" color="accent">FINAL STEP</Text>
          <Heading level="h1">Trust & Permissions</Heading>
          <Text level="body" color="secondary">
            To give you a safe, relevant dating experience, Nazar needs two key permissions.
          </Text>
        </View>

        <View style={styles.permissionsList}>
          <SurfaceCard elevation="sm" style={styles.permCard}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="location" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.permText}>
              <Text level="title">Location Services</Text>
              <Text level="bodySmall" color="secondary">
                Find potential matches in your city or neighborhood. Your exact coordinates are never shared.
              </Text>
            </View>
          </SurfaceCard>

          <SurfaceCard elevation="sm" style={styles.permCard}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="bell" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.permText}>
              <Text level="title">Push Notifications</Text>
              <Text level="bodySmall" color="secondary">
                Get alerted the moment someone likes your profile, a mutual match happens, or you receive a message.
              </Text>
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isActivating}
            onPress={handleFinish}
            accessibilityLabel="Allow permissions and enter Nazar"
          >
            Enter Nazar ✨
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
  progressBar: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  permissionsList: {
    marginVertical: 24,
    gap: 16,
  },
  permCard: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permText: {
    flex: 1,
    gap: 4,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
