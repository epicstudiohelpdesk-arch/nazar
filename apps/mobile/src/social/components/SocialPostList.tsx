import React, { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import type { PostDto } from '@platform/api-contracts';
import { PostCard } from '../../design/patterns/social/index.js';
import { EmptyState } from '../../design/components/feedback/EmptyState.js';
import { ErrorState } from '../../design/components/feedback/ErrorState.js';
import { Text } from '../../design/primitives/Text.js';
import { Button } from '../../design/components/button/Button.js';
import { useTheme } from '../../design/theme/index.js';
import { describeSocialError, formatRelativeTime } from '../social-state.js';

export interface SocialPostListProps {
  readonly posts: readonly PostDto[];
  readonly isLoading: boolean;
  readonly isRefreshing?: boolean;
  readonly isFetchingMore?: boolean;
  readonly hasMore: boolean;
  readonly error?: unknown;
  readonly onRefresh: () => void;
  readonly onEndReached: () => void;
  readonly onRetry?: () => void;
  /** Navigates to the post detail screen. */
  readonly onOpenPost?: (post: PostDto) => void;
  readonly onLike?: (post: PostDto) => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyActionLabel?: string;
  readonly onEmptyAction?: () => void;
  readonly header?: React.ReactElement | null;
  readonly testID?: string;
}

/**
 * Shared paginated post list used by the social feed, the community feed and the
 * post detail comment-free states.
 *
 * Centralising this removes three copies of the same FlatList, which had drifted
 * apart on: `hasMore` guarding, de-duplication across cursor pages, list
 * performance props and accessibility labelling.
 */
export const SocialPostList: React.FC<SocialPostListProps> = ({
  posts,
  isLoading,
  isRefreshing = false,
  isFetchingMore = false,
  hasMore,
  error,
  onRefresh,
  onEndReached,
  onRetry,
  onOpenPost,
  onLike,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Be the first to post in this space.',
  emptyActionLabel,
  onEmptyAction,
  header,
  testID = 'social-post-list',
}) => {
  const { colors, spacing } = useTheme();

  // A failed refresh while rows are still on screen must be stated: silently
  // showing old content looks exactly like fresh content. With no rows the error
  // is already rendered in full by `listEmpty`, so no banner is added.
  const isStale = !!error && posts.length > 0;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PostDto>) => (
      <View style={[styles.item, { marginBottom: spacing.md }]}>
        <PostCard
          id={item.id}
          authorName={item.author?.displayName ?? 'Nazar member'}
          authorPhoto={item.author?.avatarUrl ?? null}
          authorBadge={item.communityName ?? undefined}
          content={item.content}
          mediaUrl={item.mediaUrls?.[0] ?? null}
          timestamp={formatRelativeTime(item.createdAt)}
          likesCount={item.likeCount}
          commentsCount={item.commentCount}
          // Only `GET /v1/social/posts/:id` hydrates `userReaction`; every feed
          // endpoint returns null, so `isLiked` is always false here. That is
          // accurate rather than merely unstyled, and it means a feed can never
          // render a filled heart it cannot justify. When no `onLike` handler is
          // supplied the affordance opens the post, where the real state lives.
          isLiked={item.userReaction === 'LIKE'}
          onLike={() => (onLike ? onLike(item) : onOpenPost?.(item))}
          onCommentPress={() => onOpenPost?.(item)}
          onAuthorPress={() => onOpenPost?.(item)}
          onPress={() => onOpenPost?.(item)}
        />
        {item.mediaUrls && item.mediaUrls.length > 1 ? (
          <Text variant="caption" color="tertiary" style={styles.moreMedia}>
            +{item.mediaUrls.length - 1} more photo{item.mediaUrls.length - 1 === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
    ),
    [onLike, onOpenPost, spacing.md]
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.centered} testID={`${testID}-loading`}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
    if (error) {
      const view = describeSocialError(error);
      return (
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={onRetry}
          testID={`${testID}-error`}
        />
      );
    }
    return (
      <EmptyState
        type="noResults"
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        testID={`${testID}-empty`}
      />
    );
  }, [
    isLoading,
    error,
    onRetry,
    emptyTitle,
    emptyDescription,
    emptyActionLabel,
    onEmptyAction,
    testID,
    colors.accent,
  ]);

  // `onEndReached` must not fire when there is nothing more to fetch, otherwise
  // React Query issues duplicate cursor requests on every scroll frame.
  const handleEndReached = useCallback(() => {
    if (isFetchingMore || !hasMore) return;
    onEndReached();
  }, [isFetchingMore, hasMore, onEndReached]);

  return (
    <FlatList
      testID={testID}
      data={posts as PostDto[]}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header ?? null}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={
        isStale ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.warningSoft,
                borderRadius: 8,
                padding: 8,
                marginTop: 8,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID={`${testID}-stale`}
          >
            <Text variant="caption" color="secondary" align="center">
              Could not refresh. Showing the last saved posts.
            </Text>
            {onRetry ? (
              <Button
                label="Try again"
                variant="tertiary"
                size="sm"
                onPress={onRetry}
                accessibilityLabel="Retry loading posts"
                testID={`${testID}-stale-retry`}
              />
            ) : null}
          </View>
        ) : isFetchingMore ? (
          <View style={styles.footer} testID={`${testID}-loading-more`}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : posts.length > 0 && !hasMore ? (
          <View style={styles.footer}>
            <Text variant="caption" color="tertiary" align="center">
              You are all caught up
            </Text>
          </View>
        ) : null
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      contentContainerStyle={posts.length === 0 ? styles.emptyContent : styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // Feed performance: bound the number of mounted rows and detach off-screen
      // subviews. Without these, long communities render every loaded post at once.
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      windowSize={9}
      removeClippedSubviews
    />
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  emptyContent: {
    padding: 16,
    flexGrow: 1,
  },
  item: {
    width: '100%',
  },
  moreMedia: {
    marginTop: 4,
    marginLeft: 4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  footer: {
    paddingVertical: 24,
  },
  loadMore: {
    marginTop: 8,
  },
});

export interface SocialLoadMoreButtonProps {
  readonly hasMore: boolean;
  readonly isFetching: boolean;
  readonly onPress: () => void;
}

/** Explicit "load more" fallback for surfaces where scroll triggering is unreliable. */
export const SocialLoadMoreButton: React.FC<SocialLoadMoreButtonProps> = ({
  hasMore,
  isFetching,
  onPress,
}) => {
  if (!hasMore) return null;
  return (
    <Button
      label="Load more"
      onPress={onPress}
      variant="secondary"
      size="sm"
      loading={isFetching}
      disabled={isFetching}
      fullWidth
      style={styles.loadMore}
      testID="social-load-more"
    />
  );
};
