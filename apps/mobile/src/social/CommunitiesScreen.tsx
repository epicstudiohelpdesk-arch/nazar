import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import type { CommunityDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { CommunityCard } from '../design/components/card/CommunityCard.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { SocialLoadMoreButton } from './components/SocialPostList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import {
  byId,
  describeSocialError,
  flattenPages,
  getNextCursorPageParam,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';

export interface CommunitiesScreenProps {
  readonly client: SocialApiClient;
  readonly initialTab?: CommunityListTab;
  readonly onBack?: () => void;
}

export type CommunityListTab = 'mine' | 'discover';

const PAGE_SIZE = 20;

const TAB_LABELS: Record<CommunityListTab, string> = {
  mine: 'My communities',
  discover: 'Discover',
};

/**
 * Community list with the two server-backed views.
 *
 * There is no search endpoint, so no search box is offered. A client-side filter
 * over the first page would silently fail to match communities that have not
 * been paginated in yet, which is worse than offering no search at all.
 */
export const CommunitiesScreen: React.FC<CommunitiesScreenProps> = ({
  client,
  initialTab = 'mine',
  onBack,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const [tab, setTab] = useState<CommunityListTab>(initialTab);

  const query = useInfiniteQuery({
    queryKey:
      tab === 'mine' ? SOCIAL_QUERY_KEYS.userCommunities : SOCIAL_QUERY_KEYS.discoverCommunities,
    queryFn: ({ pageParam }) =>
      tab === 'mine'
        ? client.getUserCommunities({ limit: PAGE_SIZE, cursor: pageParam })
        : client.discoverCommunities({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
  });

  // Refetch on focus so membership changes made on a detail screen show up in
  // "My communities" as soon as the user comes back, rather than after the
  // 5 minute stale window.
  // `refetch` is referentially stable in TanStack Query, so this runs on mount and
  // on every return to this screen without refetching on every render. Switching
  // tabs changes the query key, which refetches on its own.
  const { refetch } = query;
  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const communities = flattenPages(query.data?.pages, byId) as CommunityDto[];

  const onJoin = () => {
    void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.userCommunities });
    void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.discoverCommunities });
  };

  if (query.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Communities" onBack={onBack} />
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} width="100%" height={96} radius="radiusLG" />
          ))}
        </View>
      </View>
    );
  }

  if (query.isError) {
    const view = describeSocialError(query.error);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Communities" onBack={onBack} />
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={view.isRetryable ? () => void query.refetch() : undefined}
          testID="communities-error"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title="Communities"
        onBack={onBack}
        rightAction={
          <Button
            label="New"
            icon="plus"
            size="sm"
            variant="tertiary"
            onPress={() => {
              haptics.selection();
              router.push(socialRoutes.createCommunity());
            }}
            accessibilityLabel="Create a community"
            testID="communities-create-btn"
          />
        }
      />

      <View
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        accessibilityRole="tablist"
      >
        {(Object.keys(TAB_LABELS) as CommunityListTab[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              tab === key && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}
            onPress={() => {
              haptics.selection();
              setTab(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={TAB_LABELS[key]}
            testID={`communities-tab-${key}`}
          >
            <Text
              variant="caption"
              weight={tab === key ? 'bold' : 'medium'}
              color={tab === key ? 'accent' : 'secondary'}
            >
              {TAB_LABELS[key]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <CommunityCard
              id={item.id}
              name={item.name}
              description={item.description}
              memberCount={item.memberCount}
              isJoined={tab === 'mine'}
              onPress={() => {
                haptics.selection();
                trackOnboardingEvent('community_viewed', { communityId: item.id });
                router.push(socialRoutes.community(item.id));
              }}
              onJoinPress={onJoin}
            />
          </View>
        )}
        contentContainerStyle={[
          communities.length === 0 ? styles.emptyContent : styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListEmptyComponent={
          tab === 'mine' ? (
            <EmptyState
              type="noCommunities"
              title="You have not joined any communities"
              description="Explore communities to find people who share your interests."
              primaryAction={{ label: 'Discover communities', onPress: () => setTab('discover') }}
              testID="communities-empty"
            />
          ) : (
            <EmptyState
              type="noCommunities"
              title="No communities to show"
              description="Check back soon, or start one of your own."
              primaryAction={{
                label: 'Create a community',
                onPress: () => router.push(socialRoutes.createCommunity()),
              }}
              testID="communities-discover-empty"
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <SocialLoadMoreButton
              hasMore={query.hasNextPage}
              isFetching={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
            {communities.length > 0 ? (
              <View style={[styles.legend, { marginTop: spacing.sm }]}>
                <Icon name="info" size="tiny" color={colors.textTertiary} />
                <Text variant="caption" color="tertiary" style={{ marginLeft: 6 }}>
                  Order is set by Nazar, not by your device.
                </Text>
              </View>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={9}
        removeClippedSubviews
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  footer: {
    paddingVertical: 16,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
