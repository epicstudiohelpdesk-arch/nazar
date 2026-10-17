import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { Button } from '../design/components/button/Button.js';
import { Banner } from '../design/components/feedback/Banner.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { SkeletonCard, Spinner } from '../design/components/feedback/LoadingSkeleton.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import type { NotificationsApiClient } from './notifications-api.js';
import { buildNotificationViewModel, type NotificationViewModel } from './notification-state.js';
import type { PushPermissionState } from './push-permissions.js';
import { NotificationRow } from './components/NotificationRow.js';
import { UnreadBadge } from './components/UnreadBadge.js';
import { PushPermissionCard } from './components/PushPermissionCard.js';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsFeed,
  useUnreadCount,
} from './useNotifications.js';

export interface NotificationsScreenProps {
  readonly client: NotificationsApiClient;
  readonly pushPermission: PushPermissionState;
  readonly onEnablePush: () => void;
  readonly isEnablingPush?: boolean;
  /** Hides the permission card, e.g. once push is granted. */
  readonly showPermissionCard?: boolean;
  readonly onBack?: () => void;
}

const SKELETON_ROWS = 6;

/**
 * The Activity Center.
 *
 * Rows are rendered in the order the server sent them and are never re-sorted
 * locally. A row tap marks the notification read and, when the notification
 * carries a resolvable target, navigates through the shared allowlist; a read
 * that fails still navigates, because the user's intent was to open the content
 * and the read state is reconciled separately.
 */
export function NotificationsScreen({
  client,
  pushPermission,
  onEnablePush,
  isEnablingPush = false,
  showPermissionCard = true,
  onBack,
}: NotificationsScreenProps): React.JSX.Element {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const feed = useNotificationsFeed(client);
  const unread = useUnreadCount(client);
  const markRead = useMarkNotificationRead(client);
  const markAllRead = useMarkAllNotificationsRead(client);

  const [pendingId, setPendingId] = useState<string | null>(null);
  // `Date.now()` is captured once per mount pass so a list render does not
  // produce a different relative timestamp for every row on each tick.
  const [now] = useState(() => Date.now());

  const viewModels = useMemo(
    () => feed.notifications.map((n) => buildNotificationViewModel(n, now)),
    [feed.notifications, now]
  );

  const handlePress = useCallback(
    (viewModel: NotificationViewModel) => {
      const { notification, resolved } = viewModel;
      trackOnboardingEvent('notifications_center_viewed', { source: 'activity_center' });

      if (viewModel.isUnread) {
        setPendingId(notification.id);
        // The destination is authoritative for access, so a read failure must
        // not strand the user on the list.
        markRead.mutate(notification.id, {
          onSettled: () => setPendingId(null),
        });
      }

      if (resolved.destination) {
        trackOnboardingEvent('notification_opened', {
          notification_type: notification.type,
          destination_kind: resolved.destination.kind,
        });
        router.push(resolved.destination.route as never);
        return;
      }

      if (resolved.reason === 'malformed_target_id' || resolved.reason === 'unknown_type') {
        trackOnboardingEvent('notification_navigation_failed', {
          notification_type: notification.type,
          reason: resolved.reason,
        });
      }
    },
    [markRead, router]
  );

  const handleMarkAll = useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  const isInitialLoading = feed.isLoading && viewModels.length === 0;

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {showPermissionCard && pushPermission !== 'granted' && (
        <PushPermissionCard
          permission={pushPermission}
          onEnable={onEnablePush}
          isBusy={isEnablingPush}
        />
      )}

      {unread.count > 0 && (
        <View style={styles.markAllRow}>
          <Text variant="bodySmall" color="secondary">
            {unread.count === 1 ? '1 unread' : `${unread.count} unread`}
          </Text>
          <Button
            label="Mark all read"
            variant="tertiary"
            size="sm"
            onPress={handleMarkAll}
            isLoading={markAllRead.isPending}
            accessibilityLabel="Mark all notifications as read"
            accessibilityHint={`Marks all ${unread.count} unread notifications as read`}
            testID="mark-all-read"
          />
        </View>
      )}

      {feed.isStale && (
        <Banner
          variant="offline"
          message="Showing your last synced activity"
          description="Pull down to try again."
          actionLabel="Retry"
          onAction={feed.refetch}
          testID="notifications-stale-banner"
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <TopNavHeader
        title="Activity"
        onBack={onBack}
        rightAction={
          unread.count > 0 ? (
            <UnreadBadge count={unread.count} testID="activity-center-badge" />
          ) : undefined
        }
      />

      {isInitialLoading ? (
        <View style={[styles.skeletonList, { paddingHorizontal: spacing.md }]}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : feed.error ? (
        <View style={styles.centered}>
          <ErrorState type="unknown" message={feed.error} onRetry={feed.refetch} />
        </View>
      ) : (
        <FlatList
          data={viewModels}
          keyExtractor={(item) => item.notification.id}
          renderItem={({ item }) => (
            <NotificationRow
              viewModel={item}
              onPress={handlePress}
              isBusy={pendingId === item.notification.id}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.centered}>
              <EmptyState
                type="no_notifications"
                title="You're all caught up"
                description="New matches, messages, likes and community activity will appear here."
                primaryAction={{
                  label: 'Review preferences',
                  onPress: () => router.push('/settings/notifications' as never),
                }}
              />
            </View>
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.footer}>
                <Spinner size="small" />
              </View>
            ) : viewModels.length > 0 && !feed.hasMore ? (
              <View style={styles.footer}>
                <Text variant="caption" color="tertiary">
                  That's everything from the last 30 days.
                </Text>
              </View>
            ) : null
          }
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefreshing}
              onRefresh={feed.refetch}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={
            viewModels.length === 0 ? styles.emptyList : { paddingBottom: spacing.xl }
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skeletonList: {
    gap: 12,
    paddingVertical: 16,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
