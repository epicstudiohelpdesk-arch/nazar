import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { NotificationResponseDto } from '@platform/api-contracts';
import type { NotificationsApiClient } from './notifications-api.js';
import { notificationManager } from './notification-manager.js';

export interface NotificationsScreenProps {
  readonly client: NotificationsApiClient;
}

export function NotificationsScreen({ client }: NotificationsScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationResponseDto[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadNotifications = useCallback(
    async (refresh: boolean = false) => {
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        const cursor = refresh ? undefined : nextCursor || undefined;
        const res = await client.listNotifications({ limit: 20, cursor });

        if (refresh) {
          setItems([...res.items]);
        } else {
          setItems((prev) => [...prev, ...res.items]);
        }

        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setUnreadCount(res.totalUnreadCount);
      } catch (err: unknown) {
        console.error('Failed to load notifications:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client, nextCursor]
  );

  useEffect(() => {
    loadNotifications(true);
  }, [client]);

  const handleMarkAllRead = async () => {
    try {
      await client.markAllAsRead();
      setItems((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err: unknown) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleItemPress = async (item: NotificationResponseDto) => {
    if (!item.readAt) {
      try {
        await client.markAsRead(item.id);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err: unknown) {
        console.error('Failed to mark notification read:', err);
      }
    }

    // Resolve deep link route and navigate
    const route = notificationManager.resolveDeepLinkRoute({
      type: item.type,
      ...(item.data as Record<string, unknown>),
    });

    if (route && route !== '/notifications') {
      router.push(route as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  };

  const renderItem = ({ item }: { item: NotificationResponseDto }) => {
    const isUnread = !item.readAt;

    let badgeColor = '#6366f1';
    let badgeText = 'Notice';

    if (item.type === 'NEW_MATCH') {
      badgeColor = '#ec4899';
      badgeText = 'Match';
    } else if (item.type === 'NEW_MESSAGE') {
      badgeColor = '#3b82f6';
      badgeText = 'Message';
    } else if (item.type === 'NEW_LIKE') {
      badgeColor = '#f59e0b';
      badgeText = 'Like';
    } else if (item.type === 'ACCOUNT_RESTRICTION' || item.type === 'SECURITY_ALERT') {
      badgeColor = '#ef4444';
      badgeText = 'Security';
    }

    return (
      <TouchableOpacity
        style={[styles.itemContainer, isUnread && styles.itemUnread]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <Text style={[styles.itemTitle, isUnread && styles.itemTitleBold]}>{item.title}</Text>
        <Text style={styles.itemBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.itemTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>You have no new notifications right now.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadNotifications(true)}
              tintColor="#6366f1"
            />
          }
          onEndReached={() => {
            if (hasMore && !isLoading && !isRefreshing) {
              loadNotifications(false);
            }
          }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  unreadCountBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  markAllText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  itemContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  itemUnread: {
    backgroundColor: '#1e293b',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  itemTitle: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  itemTitleBold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  itemBody: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 6,
  },
  itemTime: {
    fontSize: 12,
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
