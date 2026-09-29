import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

interface SettingsItemProps {
  icon: 'settings' | 'shield' | 'bell' | 'lock' | 'sparkles' | 'flag';
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}

function SettingsRow({ icon, title, subtitle, onPress, destructive }: SettingsItemProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconBox, { backgroundColor: destructive ? theme.colors.error + '15' : theme.colors.surfaceMuted }]}>
        <Icon name={icon} size={20} color={destructive ? theme.colors.error : theme.colors.textPrimary} />
      </View>
      <View style={styles.rowText}>
        <Text level="title" color={destructive ? 'error' : 'primary'}>
          {title}
        </Text>
        {subtitle && (
          <Text level="bodySmall" color="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      <Icon name="chevron" size={18} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function SettingsHubRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const authClient = getDefaultAuthClient();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of your Nazar account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authClient.logout();
          } finally {
            router.replace('/(auth)/welcome');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Settings"
        onBack={() => router.back()}
        leftAction="back"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Heading level="h3">Account & Security</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <SettingsRow
              icon="lock"
              title="Account & Devices"
              subtitle="Phone, active sessions, and security"
              onPress={() => router.push('/settings/account')}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <SettingsRow
              icon="shield"
              title="Privacy Controls"
              subtitle="Discovery visibility and location"
              onPress={() => router.push('/settings/privacy')}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <SettingsRow
              icon="flag"
              title="Safety & Blocked Users"
              subtitle="Manage blocks and safety resources"
              onPress={() => router.push('/settings/safety')}
            />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <Heading level="h3">Preferences & Membership</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <SettingsRow
              icon="sparkles"
              title="Nazar Gold Subscription"
              subtitle="Manage benefits and billing"
              onPress={() => router.push('/billing')}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <SettingsRow
              icon="bell"
              title="Notification Preferences"
              subtitle="Match alerts, chats, and pushes"
              onPress={() => router.push('/settings/notifications')}
            />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <Heading level="h3">Actions</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <SettingsRow
              icon="settings"
              title="Log Out"
              onPress={handleLogout}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <SettingsRow
              icon="lock"
              title="Delete Account"
              subtitle="Permanently remove your account and data"
              destructive
              onPress={() => router.push('/settings/delete-account')}
            />
          </SurfaceCard>
        </View>

        <Text level="caption" color="tertiary" style={styles.versionText}>
          Nazar Mobile v1.0.0 (Release Candidate)
        </Text>
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
  section: {
    gap: 12,
  },
  card: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 8,
  },
});
