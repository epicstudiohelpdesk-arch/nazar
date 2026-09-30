import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { CommunityDto, PostDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SocialPostList } from './components/SocialPostList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import {
  byId,
  deriveMembershipView,
  flattenPages,
  getNextCursorPageParam,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CommunityFeedScreenProps {
  readonly client: SocialApiClient;
  readonly communityId: string;
  readonly onBack?: () => void;
}

const PAGE_SIZE = 20;

/**
 * Standalone, paginated community feed.
 *
 * Reachable as its own route so a post's community badge can deep-link straight
 * to the feed. The community detail screen renders the same query inline as its
 * default tab, so both surfaces share one cache entry and one ordering.
 *
 * The previous version of this file kept its own `useState` cursor and hand-rolled
 * `FlatList` chrome, which meant no error or empty handling, no de-duplication,
 * and a hardcoded iOS-blue palette that ignored the F0 theme.
 */
export const CommunityFeedScreen: React.FC<CommunityFeedScreenProps> = ({
  client,
  communityId,
  onBack,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  const communityQuery = useQuery<CommunityDto>({
    queryKey: SOCIAL_QUERY_KEYS.community(communityId),
    queryFn: () => client.getCommunity(communityId),
    enabled: Boolean(communityId),
  });

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.communityFeed(communityId),
    queryFn: ({ pageParam }) =>
      client.getCommunityFeed(communityId, { limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: Boolean(communityId),
  });

  useEffect(() => {
    trackOnboardingEvent('community_feed_viewed', { communityId });
  }, [communityId]);

  const posts = flattenPages(query.data?.pages, byId) as PostDto[];
  const membership = deriveMembershipView(communityQuery.data ?? {});

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SocialPostList
        posts={posts}
        isLoading={query.isLoading}
        isRefreshing={query.isRefetching && !query.isFetchingNextPage}
        isFetchingMore={query.isFetchingNextPage}
        hasMore={query.hasNextPage}
        error={query.error}
        onRefresh={() => void query.refetch()}
        onEndReached={() => void query.fetchNextPage()}
        onRetry={() => void query.refetch()}
        onOpenPost={(post) => router.push(socialRoutes.post(post.id))}
        emptyTitle="No posts here yet"
        emptyDescription={
          membership.isMember
            ? 'Be the first to share something with this community.'
            : 'Join this community to see and share posts.'
        }
        emptyActionLabel={membership.canCreatePost ? 'Create a post' : 'View community'}
        onEmptyAction={() =>
          membership.canCreatePost
            ? router.push(socialRoutes.createPost(communityId))
            : router.push(socialRoutes.community(communityId))
        }
        header={
          <View style={styles.header}>
            <TopNavHeader
              title={communityQuery.data?.name ?? 'Community feed'}
              onBack={onBack}
              rightAction={
                membership.canCreatePost ? (
                  <Button
                    label="Post"
                    icon="edit"
                    size="sm"
                    variant="tertiary"
                    onPress={() => router.push(socialRoutes.createPost(communityId))}
                    accessibilityLabel="Create a post in this community"
                    testID="community-feed-create"
                  />
                ) : undefined
              }
            />
          </View>
        }
        testID="community-feed-screen"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginHorizontal: -16,
    marginTop: -16,
  },
});
