import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@platform/ui';
import type { ConversationItemDto } from '@platform/api-contracts';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { createChatApi, CHAT_QUERY_KEYS } from './chat-api.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface ConversationsScreenProps {
  readonly authClient?: AuthClient;
  readonly onSelectConversation?: (conversationId: string) => void;
  readonly onBack?: () => void;
}

export const ConversationsScreen: React.FC<ConversationsScreenProps> = ({
  authClient,
  onSelectConversation,
}) => {
  const router = useRouter();
  const effectiveClient = useMemo(() => authClient || getDefaultAuthClient(), [authClient]);
  const chatApi = useMemo(() => createChatApi(effectiveClient), [effectiveClient]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: CHAT_QUERY_KEYS.conversations,
    queryFn: () => chatApi.getConversations({ limit: 50 }),
  });

  const handleSelectConversation = useCallback(
    (item: ConversationItemDto) => {
      if (onSelectConversation) {
        onSelectConversation(item.id);
      } else {
        router.push(`/chat/${item.id}` as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    },
    [router, onSelectConversation]
  );

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderConversationItem = ({ item }: { item: ConversationItemDto }) => {
    const avatarUrl = item.otherUser.primaryMedia?.url;
    const lastPreview = item.lastMessage?.preview || 'Matched! Say hello 👋';
    const timestamp = item.lastMessage ? formatTimestamp(item.lastMessage.sentAt) : '';

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handleSelectConversation(item)}
        activeOpacity={0.7}
        testID={`conv-item-${item.id}`}
      >
        <View style={styles.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {item.otherUser.displayName.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          {item.unreadCount > 0 && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>
              {item.otherUser.displayName}
              {item.otherUser.age ? `, ${item.otherUser.age}` : ''}
            </Text>
            {timestamp ? <Text style={styles.timeText}>{timestamp}</Text> : null}
          </View>

          <View style={styles.previewRow}>
            <Text
              style={[
                styles.previewText,
                item.unreadCount > 0 ? styles.previewUnread : null,
              ]}
              numberOfLines={1}
            >
              {lastPreview}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && !isRefetching) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>Failed to load conversations</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = data?.items || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        contentContainerStyle={items.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              When you match with someone, you can chat with them here!
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: colors.neutral[900],
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral[200],
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary[700],
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[500],
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nameText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.neutral[400],
    marginRight: spacing.sm,
  },
  previewUnread: {
    color: colors.neutral[900],
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary[500],
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.neutral[400],
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.status.error,
    marginBottom: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[400],
    textAlign: 'center',
    lineHeight: 22,
  },
});
