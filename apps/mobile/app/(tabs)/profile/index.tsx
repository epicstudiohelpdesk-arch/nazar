import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ProfileOverviewScreen } from '../../../src/profile/ProfileOverviewScreen.js';
import { TopNavHeader } from '../../../src/design/components/navigation/TopNavHeader.js';
import { IconButton } from '../../../src/design/components/button/IconButton.js';
import { useTheme } from '../../../src/design/theme/ThemeContext.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';
import { createNotificationsApi } from '../../../src/notifications/notifications-api.js';
import { useUnreadCount } from '../../../src/notifications/useNotifications.js';
import {
  UnreadBadge,
  buildBadgeA11yLabel,
} from '../../../src/notifications/components/UnreadBadge.js';

export default function ProfileTabRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const authClient = getDefaultAuthClient();
  const notificationsApi = useMemo(() => createNotificationsApi(authClient), [authClient]);
  const unread = useUnreadCount(notificationsApi);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="My Profile"
        rightAction={
          <View style={styles.headerActions}>
            <View>
              <IconButton
                icon="bell"
                size="sm"
                variant="secondary"
                accessibilityLabel={buildBadgeA11yLabel('Open Activity', unread.count)}
                accessibilityHint="Shows your matches, messages and community activity"
                onPress={() => router.push('/notifications')}
                testID="profile-notifications-button"
              />
              {unread.count > 0 && (
                <View style={styles.badgeSlot} pointerEvents="none">
                  <UnreadBadge count={unread.count} testID="profile-notifications-badge" />
                </View>
              )}
            </View>
            <IconButton
              icon="sparkles"
              size="sm"
              variant="secondary"
              accessibilityLabel="View Subscription"
              onPress={() => router.push('/billing')}
            />
            <IconButton
              icon="settings"
              size="sm"
              variant="secondary"
              accessibilityLabel="Open Settings"
              onPress={() => router.push('/settings')}
            />
          </View>
        }
      />
      <ProfileOverviewScreen
        onEditPress={() => router.push('/profile/edit')}
        onUploadPhotoPress={() => router.push('/profile/edit')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  badgeSlot: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
});
