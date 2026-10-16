import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { Badge } from '../../src/design/primitives/Badge.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';
import { AUTH_QUERY_KEYS, purgeAccountSessionAndCaches } from '../../src/auth/session-service.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function AccountSettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const authClient = getDefaultAuthClient();

  // Queries
  const sessionsQuery = useQuery({
    queryKey: AUTH_QUERY_KEYS.sessions,
    queryFn: () => authClient.listSessions(),
  });

  const devicesQuery = useQuery({
    queryKey: AUTH_QUERY_KEYS.devices,
    queryFn: () => authClient.listDevices(),
  });

  // Mutations
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => authClient.revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.sessions });
      trackOnboardingEvent('session_revoked');
      Alert.alert('Session Revoked', 'The device session has been terminated.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to revoke session';
      Alert.alert('Error', msg);
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authClient.logoutAll(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.sessions });
      trackOnboardingEvent('all_sessions_revoked');
      Alert.alert(
        'Sessions Terminated',
        'All other active devices have been logged out. Your current session remains active.'
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to terminate sessions';
      Alert.alert('Error', msg);
    },
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => authClient.revokeDevice(deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.devices });
      trackOnboardingEvent('device_revoked');
      Alert.alert(
        'Device Unregistered',
        'Push notifications for this device have been unregistered.'
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to unregister device';
      Alert.alert('Error', msg);
    },
  });

  const handleConfirmRevokeSession = (sessionId: string) => {
    haptics.impactLight();
    Alert.alert(
      'Terminate Session',
      'Are you sure you want to log out this device? The user will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Device',
          style: 'destructive',
          onPress: () => {
            haptics.impactMedium();
            revokeSessionMutation.mutate(sessionId);
          },
        },
      ]
    );
  };

  const handleConfirmLogoutAll = () => {
    haptics.impactLight();
    Alert.alert(
      'Log Out All Other Devices',
      'This will revoke all active sessions except the device you are currently holding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Others',
          style: 'destructive',
          onPress: () => {
            haptics.impactMedium();
            logoutAllMutation.mutate();
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    haptics.impactMedium();
    Alert.alert('Log Out', 'Are you sure you want to log out of Nazar?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await purgeAccountSessionAndCaches(queryClient, authClient);
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const sessions = sessionsQuery.data || [];
  const otherSessions = sessions.filter((s) => !s.isCurrentSession);
  const devices = devicesQuery.data || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Account & Devices" onBack={() => router.back()} leftAction="back" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Sessions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Heading level="h3">Active Sessions ({sessions.length})</Heading>
            {otherSessions.length > 0 && (
              <Button
                variant="tertiary"
                size="sm"
                isLoading={logoutAllMutation.isPending}
                onPress={handleConfirmLogoutAll}
                accessibilityLabel="Log out all other devices"
              >
                Log Out Others
              </Button>
            )}
          </View>
          <Text level="bodySmall" color="secondary">
            Devices that currently have active access to your Nazar account.
          </Text>

          {sessionsQuery.isLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={{ marginVertical: 12 }}
            />
          ) : (
            sessions.map((session) => (
              <SurfaceCard key={session.id} elevation="sm" style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text level="title">
                      {session.deviceModel || session.platform || 'Authorized Device'}
                    </Text>
                    {session.isCurrentSession && (
                      <Badge label="Current Device" variant="accent" size="sm" />
                    )}
                  </View>
                  {!session.isCurrentSession && (
                    <TouchableOpacity
                      onPress={() => handleConfirmRevokeSession(session.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Revoke session"
                      style={styles.revokeBtn}
                    >
                      <Text level="bodySmall" color="error" weight="semibold">
                        Revoke
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.sessionDetails}>
                  {session.ipAddress && (
                    <Text level="caption" color="secondary">
                      IP: {session.ipAddress}
                    </Text>
                  )}
                  <Text level="caption" color="tertiary">
                    Signed in: {new Date(session.createdAt).toLocaleDateString()}
                  </Text>
                  {session.lastActiveAt && (
                    <Text level="caption" color="tertiary">
                      Last active: {new Date(session.lastActiveAt).toLocaleString()}
                    </Text>
                  )}
                </View>
              </SurfaceCard>
            ))
          )}
        </View>

        {/* Registered Push Devices Section */}
        <View style={styles.section}>
          <Heading level="h3">Registered Notification Devices ({devices.length})</Heading>
          <Text level="bodySmall" color="secondary">
            Devices authorized to receive instant push alerts and safety notifications.
          </Text>

          {devicesQuery.isLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={{ marginVertical: 12 }}
            />
          ) : devices.length === 0 ? (
            <SurfaceCard elevation="sm" style={styles.card}>
              <Text level="bodySmall" color="secondary">
                No external push devices currently registered.
              </Text>
            </SurfaceCard>
          ) : (
            devices.map((device) => (
              <SurfaceCard key={device.id} elevation="sm" style={styles.deviceCard}>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceInfo}>
                    <Text level="title">
                      {device.platform.toUpperCase()} {device.deviceModel || ''}
                    </Text>
                    <Text level="caption" color="tertiary">
                      Registered: {new Date(device.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => revokeDeviceMutation.mutate(device.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Unregister device"
                  >
                    <Text level="bodySmall" color="error">
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
            ))
          )}
        </View>

        {/* Security & Data Compliance Section */}
        <View style={styles.section}>
          <Heading level="h3">Security & Compliance</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.complianceRow}>
              <Icon name="shield" size={18} color={theme.colors.accent} />
              <View style={{ flex: 1 }}>
                <Text level="title">End-to-End Privacy Protection</Text>
                <Text level="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                  All network traffic is encrypted via TLS 1.3. User passwords and tokens are never
                  persisted in plain text. Coarse distance calculations protect your exact location.
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <Text level="caption" color="tertiary">
              GDPR & CCPA Compliant. You maintain full rights to export your data or delete your
              account at any time.
            </Text>
          </SurfaceCard>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Heading level="h3">Account Management</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log Out"
            >
              <Text level="title" color="primary">
                Log Out of Nazar
              </Text>
              <Icon name="chevron" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/settings/delete-account')}
              accessibilityRole="button"
              accessibilityLabel="Delete Account"
            >
              <View>
                <Text level="title" color="error">
                  Delete Account
                </Text>
                <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                  Permanently delete matches, messages, and profile data
                </Text>
              </View>
              <Icon name="chevron" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </SurfaceCard>
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
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    padding: 16,
    gap: 12,
  },
  sessionCard: {
    padding: 16,
    gap: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDetails: {
    gap: 2,
    marginTop: 4,
  },
  revokeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deviceCard: {
    padding: 14,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    gap: 2,
  },
  complianceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
