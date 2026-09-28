import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@platform/ui';
import type { DiscoveryItemDto, DiscoveryResponseDto } from '@platform/api-contracts';
import { createDiscoveryApi, DISCOVERY_QUERY_KEYS } from './discovery-api.js';
import { DiscoveryCard } from './components/DiscoveryCard.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface DiscoveryScreenProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: () => void;
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = ({ authClient, onOpenProfile }) => {
  const discoveryApi = useMemo(() => createDiscoveryApi(authClient), [authClient]);

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
  } = useInfiniteQuery<DiscoveryResponseDto, Error>({
    queryKey: DISCOVERY_QUERY_KEYS.feed,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      return discoveryApi.getDiscoveryFeed({
        cursor: pageParam as string | undefined,
        limit: 10,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore && lastPage.pagination.nextCursor
        ? lastPage.pagination.nextCursor
        : undefined,
  });

  const allItems: DiscoveryItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Loading State
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Discovering matches nearby...</Text>
      </SafeAreaView>
    );
  }

  // Error State
  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to load discovery feed</Text>
        <Text style={styles.errorSubtitle}>
          {error?.message || 'A network or server error occurred.'}
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Empty State
  if (allItems.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>No profiles nearby yet</Text>
        <Text style={styles.emptySubtitle}>
          Try expanding your age or distance preferences, or check back soon as more people join
          Nazar.
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()}>
            <Text style={styles.primaryButtonText}>Refresh Feed</Text>
          </TouchableOpacity>
          {onOpenProfile ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onOpenProfile}>
              <Text style={styles.secondaryButtonText}>Edit Preferences</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nazar</Text>
        <Text style={styles.headerSubtitle}>Social Discovery</Text>
      </View>

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.profile.id}
        renderItem={({ item }) => <DiscoveryCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary[600]}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.footerText}>Loading more profiles...</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[700],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingVertical: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.status.error,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: colors.neutral[50],
    fontWeight: typography.fontWeight.semibold as '600',
    fontSize: typography.fontSize.sm,
  },
  secondaryButton: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: colors.neutral[800],
    fontWeight: typography.fontWeight.semibold as '600',
    fontSize: typography.fontSize.sm,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
});
