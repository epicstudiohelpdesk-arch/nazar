import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@platform/ui';
import type { MatchItemDto, MatchListResponseDto } from '@platform/api-contracts';
import { createMatchesApi, MATCHES_QUERY_KEYS } from './matches-api.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface MatchesScreenProps {
  readonly authClient: AuthClient;
  readonly onSelectMatch?: (matchId: string) => void;
  readonly onBack?: () => void;
}

export const MatchesScreen: React.FC<MatchesScreenProps> = ({
  authClient,
  onSelectMatch,
  onBack,
}) => {
  const matchesApi = useMemo(() => createMatchesApi(authClient), [authClient]);

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
  } = useInfiniteQuery<MatchListResponseDto, Error>({
    queryKey: MATCHES_QUERY_KEYS.list,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      return matchesApi.getMatches({
        cursor: pageParam as string | undefined,
        limit: 20,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore && lastPage.pagination.nextCursor
        ? lastPage.pagination.nextCursor
        : undefined,
  });

  const allMatches: MatchItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Loading State
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your matches...</Text>
      </SafeAreaView>
    );
  }

  // Error State
  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to load matches</Text>
        <Text style={styles.errorSubtitle}>
          {error?.message || 'A network or server error occurred.'}
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading matches"
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Empty State
  if (allMatches.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptySubtitle}>
          When you and another member like each other, your matches will appear here. Keep
          exploring!
        </Text>
        {onBack && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Explore discovery feed"
          >
            <Text style={styles.primaryButtonText}>Explore Profiles</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.headerTitle}>Matches</Text>
          <Text style={styles.headerSubtitle}>
            {allMatches.length} mutual connection{allMatches.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <FlatList
        data={allMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const user = item.otherUser;
          const formattedDate = new Date(item.matchedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });

          return (
            <TouchableOpacity
              style={styles.matchRow}
              onPress={() => onSelectMatch?.(item.id)}
              disabled={!onSelectMatch}
              accessibilityRole="button"
              accessibilityLabel={`Match with ${user.displayName}, age ${user.age}`}
              testID={`match-item-${item.id}`}
            >
              {/* Avatar */}
              <View style={styles.avatarContainer}>
                {user.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: user.primaryPhotoUrl }}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>{user.displayName.charAt(0)}</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.matchInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>
                    {user.displayName}, {user.age}
                  </Text>
                  <Text style={styles.dateText}>{formattedDate}</Text>
                </View>

                {user.city ? (
                  <Text style={styles.locationText}>
                    📍 {user.city}
                    {user.countryCode ? `, ${user.countryCode}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.statusText}>Matched</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
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
              <Text style={styles.footerText}>Loading more matches...</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.xl,
    color: colors.neutral[800],
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[700],
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing.md,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
  },
  matchInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  nameText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  locationText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[700],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold as '600',
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
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: colors.neutral[50],
    fontWeight: typography.fontWeight.semibold as '600',
    fontSize: typography.fontSize.sm,
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
