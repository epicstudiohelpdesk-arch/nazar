import React from 'react';
import { View, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Avatar } from '../../design/primitives/Avatar.js';
import { Badge, type BadgeVariant } from '../../design/primitives/Badge.js';
import { EmptyState } from '../../design/components/feedback/EmptyState.js';
import { ErrorState } from '../../design/components/feedback/ErrorState.js';
import { SkeletonBox } from '../../design/components/feedback/LoadingSkeleton.js';
import { Button } from '../../design/components/button/Button.js';
import { SocialLoadMoreButton } from './SocialPostList.js';
import { describeSocialError } from '../social-state.js';

export interface SocialPerson {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  /** Rendered as a trailing badge, e.g. a community role. */
  readonly badgeLabel: string;
  readonly badgeVariant: BadgeVariant;
  /** Optional secondary line, e.g. waitlist promotion. */
  readonly note?: string | null;
  /** Optional per-row action, used for OWNER/ADMIN moderation. */
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

export interface SocialPeopleListProps {
  readonly people: readonly SocialPerson[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly isFetchingMore: boolean;
  readonly hasMore: boolean;
  readonly error: unknown;
  readonly onRefresh: () => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onOpenProfile: (userId: string) => void;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly loadingTestID?: string;
  readonly listTestID?: string;
}

/**
 * Shared paginated people list for community members and event attendees.
 *
 * Both endpoints return the same cursor-paged `{ items, nextCursor, hasMore }`
 * shape with a nested `user`, so a single implementation keeps pagination,
 * de-duplication, empty/error/loading states and accessibility identical
 * between the two surfaces.
 */
export const SocialPeopleList: React.FC<SocialPeopleListProps> = ({
  people,
  isLoading,
  isRefreshing,
  isFetchingMore,
  hasMore,
  error,
  onRefresh,
  onLoadMore,
  onRetry,
  onOpenProfile,
  emptyTitle,
  emptyDescription,
  loadingTestID,
  listTestID = 'social-people-list',
}) => {
  const { colors, spacing } = useTheme();

  // Cached rows plus a failed refresh is a degraded state, not a dead end: the
  // list stays usable and the banner says the content may be out of date. With no
  // rows at all the error is rendered in full instead.
  const isStale = !!error && people.length > 0;

  if (isLoading) {
    return (
      <View
        style={[styles.loadingWrap, { padding: spacing.md, gap: spacing.md }]}
        testID={loadingTestID}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonBox key={i} width="100%" height={64} radius="radiusMD" />
        ))}
      </View>
    );
  }

  if (error && people.length === 0) {
    const view = describeSocialError(error);
    return (
      <ErrorState
        type={view.stateType}
        title={view.title}
        message={view.message}
        onRetry={view.isRetryable ? onRetry : undefined}
        testID={`${listTestID}-error`}
      />
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<SocialPerson>) => (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 12,
          padding: spacing.md,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.rowMain}
        activeOpacity={0.7}
        onPress={() => onOpenProfile(item.userId)}
        accessibilityRole="button"
        accessibilityLabel={`${item.displayName}, ${item.badgeLabel}`}
        accessibilityHint="Opens their profile"
        testID={`${listTestID}-item-${item.id}`}
      >
        <Avatar name={item.displayName || 'Member'} uri={item.avatarUrl ?? undefined} size="md" />
        <View style={[styles.rowText, { marginLeft: spacing.md }]}>
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {item.displayName || 'Member'}
          </Text>
          {item.note ? (
            <Text variant="caption" color="secondary" numberOfLines={2}>
              {item.note}
            </Text>
          ) : null}
        </View>
        <Badge label={item.badgeLabel} variant={item.badgeVariant} size="sm" />
      </TouchableOpacity>
      {item.action ? (
        <Button
          label={item.action.label}
          onPress={item.action.onPress}
          variant="tertiary"
          size="sm"
          style={styles.rowAction}
          accessibilityLabel={`${item.action.label} for ${item.displayName}`}
          testID={`${listTestID}-action-${item.id}`}
        />
      ) : null}
    </View>
  );

  return (
    <FlatList
      testID={listTestID}
      data={people as SocialPerson[]}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      contentContainerStyle={people.length === 0 ? styles.emptyContent : styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListEmptyComponent={
        <EmptyState
          type="noResults"
          title={emptyTitle}
          description={emptyDescription}
          testID={`${listTestID}-empty`}
        />
      }
      ListHeaderComponent={
        isStale ? (
          <View
            style={[
              styles.staleBanner,
              { backgroundColor: colors.warningSoft, borderRadius: 8, padding: 8 },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID={`${listTestID}-stale`}
          >
            <Text variant="caption" color="secondary" align="center">
              Could not refresh. Showing the last saved list.
            </Text>
            <Button
              label="Try again"
              variant="tertiary"
              size="sm"
              onPress={onRetry}
              accessibilityLabel="Retry loading the list"
              testID={`${listTestID}-stale-retry`}
            />
          </View>
        ) : null
      }
      ListFooterComponent={
        <SocialLoadMoreButton hasMore={hasMore} isFetching={isFetchingMore} onPress={onLoadMore} />
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !isFetchingMore) onLoadMore();
      }}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
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
    flexGrow: 1,
    padding: 16,
  },
  loadingWrap: {
    flex: 1,
  },
  row: {
    borderWidth: 1,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowAction: {
    marginTop: 8,
  },
  staleBanner: {
    marginBottom: 8,
    alignItems: 'center',
    gap: 4,
  },
});
