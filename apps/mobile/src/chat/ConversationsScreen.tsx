import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ConversationItemDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SearchInput } from '../design/components/input/SearchInput.js';
import { ConversationCard } from '../design/components/card/ConversationCard.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { createChatApi, CHAT_QUERY_KEYS } from './chat-api.js';
import { chatSocket } from './chat-socket.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import type { AuthClient } from '../auth/auth-client.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';

export interface ConversationsScreenProps {
  readonly authClient?: AuthClient;
  readonly onSelectConversation?: (conversationId: string) => void;
  readonly onBack?: () => void;
}

export const ConversationsScreen: React.FC<ConversationsScreenProps> = ({
  authClient,
  onSelectConversation,
  onBack,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  const [searchQuery, setSearchQuery] = useState('');

  const effectiveClient = useMemo(() => authClient || getDefaultAuthClient(), [authClient]);
  const chatApi = useMemo(() => createChatApi(effectiveClient), [effectiveClient]);

  // Analytics on mount
  useEffect(() => {
    trackOnboardingEvent('conversations_viewed');
  }, []);

  // Listen to WebSocket events to invalidate conversation list
  useEffect(() => {
    const unsubMsg = chatSocket.onMessageCreated(() => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    });
    const unsubRead = chatSocket.onMessageRead(() => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    });

    return () => {
      unsubMsg();
      unsubRead();
    };
  }, [queryClient]);

  // Infinite Query for Conversations
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.conversations,
    queryFn: ({ pageParam }) =>
      chatApi.getConversations({ limit: 20, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Flatten and deduplicate conversations across pages
  const allConversations = useMemo(() => {
    if (!data?.pages) return [];
    const map = new Map<string, ConversationItemDto>();
    for (const page of data.pages) {
      for (const item of page.items) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
    return Array.from(map.values());
  }, [data]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allConversations;
    return allConversations.filter(
      (c) =>
        c.otherUser.displayName.toLowerCase().includes(query) ||
        (c.lastMessage?.preview && c.lastMessage.preview.toLowerCase().includes(query))
    );
  }, [allConversations, searchQuery]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      haptics.selection();
      trackOnboardingEvent('conversation_opened', { conversationId });
      if (onSelectConversation) {
        onSelectConversation(conversationId);
      } else {
        router.push(`/chat/${conversationId}` as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    },
    [router, onSelectConversation]
  );

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '';
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

  const renderConversationItem = useCallback(
    ({ item }: { item: ConversationItemDto }) => {
      const avatarUrl = item.otherUser.primaryMedia?.url;
      const lastPreview = item.lastMessage?.preview || 'Matched! Say hello';
      const timestamp = item.lastMessage ? formatTimestamp(item.lastMessage.sentAt) : '';

      return (
        <ConversationCard
          id={item.id}
          name={item.otherUser.displayName}
          avatarUrl={avatarUrl}
          lastMessage={lastPreview}
          timestamp={timestamp}
          unreadCount={item.unreadCount}
          onPress={() => handleSelectConversation(item.id)}
          testID={`conv-item-${item.id}`}
        />
      );
    },
    [handleSelectConversation]
  );

  const renderSkeletonList = () => (
    <View
      style={[
        styles.skeletonContainer,
        { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
      ]}
    >
      {Array.from({ length: 5 }, (_, idx) => (
        <View
          key={idx}
          style={[
            styles.skeletonRow,
            { borderBottomColor: colors.border, paddingVertical: spacing.md },
          ]}
        >
          <SkeletonBox
            width={56}
            height={56}
            radius="radiusFull"
            style={{ marginRight: spacing.md }}
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SkeletonBox
              width="50%"
              height={16}
              radius="radiusSM"
              style={{ marginBottom: spacing.xs }}
            />
            <SkeletonBox width="80%" height={14} radius="radiusSM" />
          </View>
        </View>
      ))}
    </View>
  );

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader title="Messages" leftAction={onBack ? 'back' : 'none'} onBack={onBack} />

      <View
        style={[
          styles.searchWrapper,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations..."
          onClear={() => setSearchQuery('')}
        />
      </View>

      {isLoading && !isRefetching ? (
        renderSkeletonList()
      ) : error ? (
        <ErrorState
          type="server_error"
          title="Failed to load conversations"
          message={
            error instanceof Error ? error.message : 'Please check your connection and try again.'
          }
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={[
            filteredConversations.length === 0 ? styles.emptyListContent : styles.listContent,
            { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.accent}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            searchQuery.trim().length > 0 ? (
              <EmptyState
                type="noResults"
                title="No conversations found"
                description={`No results matching "${searchQuery}".`}
                primaryAction={{
                  label: 'Clear Search',
                  onPress: () => setSearchQuery(''),
                }}
              />
            ) : (
              <EmptyState
                type="noMessages"
                title="No messages yet"
                description="When you match with someone, your conversations will appear here."
                primaryAction={{
                  label: 'View Matches',
                  onPress: () => router.push('/(tabs)/matches' as any), // eslint-disable-line @typescript-eslint/no-explicit-any
                }}
              />
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
