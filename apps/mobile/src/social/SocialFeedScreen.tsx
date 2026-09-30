import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { PostDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SocialPostList } from './components/SocialPostList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { byId, flattenPages, getNextCursorPageParam, socialRoutes } from './social-state.js';

export interface SocialFeedScreenProps {
  readonly client: SocialApiClient;
  readonly onBack?: () => void;
}

const PAGE_SIZE = 20;

/**
 * Global, paginated post feed.
 *
 * This screen used to host nested Feed/Communities/Events tabs. Those lists now
 * have their own routes (`/social/communities`, `/social/events`) and the Explore
 * tab shows the curated {@link SocialHomeScreen}, so nesting them here only made
 * navigation ambiguous and kept three lists mounted at once.
 *
 * Reaction behaviour: the feed endpoint returns `userReaction: null` for every
 * post because it is not hydrated per viewer. This screen therefore offers no
 * reaction mutation, and the "liked" indicator is never shown from feed data.
 * Only `GET /v1/social/posts/:id` reports a real reaction, and that is where the
 * toggle lives; tapping the feed heart opens the post.
 */
export const SocialFeedScreen: React.FC<SocialFeedScreenProps> = ({ client, onBack }) => {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.feed(),
    queryFn: ({ pageParam }) => client.getFeed({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
  });

  const posts = useMemo(() => flattenPages(query.data?.pages, byId) as PostDto[], [query.data]);

  const header = (
    <View style={[styles.header, { marginBottom: spacing.md }]}>
      <TopNavHeader
        title="Latest posts"
        onBack={onBack}
        rightAction={
          <Button
            label="Post"
            icon="edit"
            size="sm"
            variant="tertiary"
            onPress={() => router.push(socialRoutes.createPost())}
            accessibilityLabel="Create a post"
            testID="feed-create-post"
          />
        }
      />
    </View>
  );

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
        emptyTitle="No posts yet"
        emptyDescription="Start the conversation, or join a community to see posts from people you share interests with."
        emptyActionLabel="Create the first post"
        onEmptyAction={() => router.push(socialRoutes.createPost())}
        header={header}
        testID="social-feed"
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
