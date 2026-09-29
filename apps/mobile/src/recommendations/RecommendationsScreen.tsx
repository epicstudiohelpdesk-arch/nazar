import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@platform/ui';
import type { DiscoveryItemDto, RecommendationResponseDto } from '@platform/api-contracts';
import { createRecommendationsApi, RECOMMENDATIONS_QUERY_KEYS } from './recommendations-api.js';
import { DiscoveryCard } from '../discovery/components/DiscoveryCard.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface RecommendationsScreenProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: () => void;
}

export const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({ authClient }) => {
  const recommendationsApi = useMemo(() => createRecommendationsApi(authClient), [authClient]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<RecommendationResponseDto>({
    queryKey: RECOMMENDATIONS_QUERY_KEYS.feed('PERSONALIZED_DISCOVERY'),
    queryFn: ({ pageParam }) =>
      recommendationsApi.getRecommendations({
        mode: 'PERSONALIZED_DISCOVERY',
        cursor: pageParam as string | undefined,
        limit: 10,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  const allItems: DiscoveryItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Finding best matches for you...</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {(error as Error)?.message || 'Failed to load recommendations'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.profile.id}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <DiscoveryCard item={item} />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerLoader} color={colors.primary[500]} />
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  cardContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.status.error,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.md,
  },
});
