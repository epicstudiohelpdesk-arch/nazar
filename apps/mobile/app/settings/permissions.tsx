import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon, type IconName } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

interface PermissionRowProps {
  icon: IconName;
  title: string;
  description: string;
  privacyNote: string;
}

function PermissionCard({
  icon,
  title,
  description,
  privacyNote,
}: PermissionRowProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <SurfaceCard elevation="sm" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
          <Icon name={icon} size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text level="title">{title}</Text>
          <Text level="bodySmall" color="secondary">
            {description}
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <Text level="caption" color="tertiary">
        Privacy Note: {privacyNote}
      </Text>
    </SurfaceCard>
  );
}

export default function PermissionsSettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  useEffect(() => {
    trackOnboardingEvent('permissions_viewed');
  }, []);

  const handleOpenSettings = async () => {
    haptics.impactMedium();
    try {
      await Linking.openSettings();
    } catch {
      // Graceful fallback if system linking unavailable
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="App Permissions"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/settings');
          }
        }}
        leftAction="back"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Heading level="h2">Device Permissions</Heading>
          <Text level="bodySmall" color="secondary">
            Manage system-level permissions granted to Nazar. You can update these permissions at
            any time in your device settings.
          </Text>
        </View>

        <View style={styles.permissionsList}>
          <PermissionCard
            icon="bell"
            title="Push Notifications"
            description="Receive immediate alerts when you get a new match, chat message, or event invite."
            privacyNote="We only notify you of high-value interactions. No marketing spam."
          />

          <PermissionCard
            icon="camera"
            title="Camera & Photos"
            description="Upload authentic photos to your profile and complete photo verification."
            privacyNote="We only access the specific photos you select. No background access."
          />

          <PermissionCard
            icon="location"
            title="Location Services"
            description="Calculate coarse distance to potential matches in your city or region."
            privacyNote="Exact coordinates are never stored or shared with other members."
          />
        </View>

        <View style={styles.actionWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleOpenSettings}
            accessibilityLabel="Open device settings"
          >
            Open System Settings
          </Button>
          <Text level="caption" color="tertiary" style={styles.helpText}>
            Tapping will take you to your phone's Settings application to manage camera, location,
            and notification privileges.
          </Text>
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
    paddingBottom: 40,
  },
  header: {
    gap: 6,
  },
  permissionsList: {
    gap: 16,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
  },
  actionWrapper: {
    marginTop: 8,
    gap: 12,
  },
  helpText: {
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
