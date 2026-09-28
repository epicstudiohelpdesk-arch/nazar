import React, { useMemo, useState } from 'react';
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
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@platform/ui';
import type { DiscoveryItemDto, DiscoveryResponseDto } from '@platform/api-contracts';
import { createDiscoveryApi, DISCOVERY_QUERY_KEYS } from './discovery-api.js';
import { DiscoveryCard } from './components/DiscoveryCard.js';
import { createInteractionsApi } from '../interactions/interactions-api.js';
import { MATCHES_QUERY_KEYS } from '../matches/matches-api.js';
import {
  MatchCelebrationModal,
  type MatchedCelebrationUser,
} from '../matches/components/MatchCelebrationModal.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface DiscoveryScreenProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: () => void;
  readonly onOpenMatches?: () => void;
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = ({
  authClient,
  onOpenProfile,
  onOpenMatches,
}) => {
  const queryClient = useQueryClient();
  const discoveryApi = useMemo(() => createDiscoveryApi(authClient), [authClient]);
  const interactionsApi = useMemo(() => createInteractionsApi(authClient), [authClient]);

  // Track interacted items locally for responsive card advancement
  const [interactedProfileIds, setInteractedProfileIds] = useState<Set<string>>(new Set());
  const [submittingProfileId, setSubmittingProfileId] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  // Match celebration state
  const [celebrationMatch, setCelebrationMatch] = useState<{
    matchId: string;
    user: MatchedCelebrationUser;
  } | null>(null);

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

  const likeMutation = useMutation({
    mutationFn: async (item: DiscoveryItemDto) => {
      setSubmittingProfileId(item.profile.id);
      setInteractionError(null);
      const targetUserId = item.profile.userId || item.profile.id;
      return interactionsApi.like(targetUserId);
    },
    onSuccess: (res, item) => {
      setInteractedProfileIds((prev) => new Set(prev).add(item.profile.id));
      if (res.matched && res.matchId) {
        queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });
        const primaryPhoto =
          item.profile.media.find((m) => m.isPrimary) ||
          (item.profile.media.length > 0 ? item.profile.media[0] : null);

        setCelebrationMatch({
          matchId: res.matchId,
          user: {
            displayName: item.profile.displayName,
            age: item.profile.age,
            primaryPhotoUrl: primaryPhoto?.url || null,
            city: item.profile.city || null,
            countryCode: item.profile.countryCode || null,
          },
        });
      }
    },
    onError: (err: Error, item) => {
      setInteractionError(`Failed to like ${item.profile.displayName}: ${err.message}`);
    },
    onSettled: () => {
      setSubmittingProfileId(null);
    },
  });

  const passMutation = useMutation({
    mutationFn: async (item: DiscoveryItemDto) => {
      setSubmittingProfileId(item.profile.id);
      setInteractionError(null);
      const targetUserId = item.profile.userId || item.profile.id;
      return interactionsApi.pass(targetUserId);
    },
    onSuccess: (_, item) => {
      setInteractedProfileIds((prev) => new Set(prev).add(item.profile.id));
    },
    onError: (err: Error, item) => {
      setInteractionError(`Failed to pass on ${item.profile.displayName}: ${err.message}`);
    },
    onSettled: () => {
      setSubmittingProfileId(null);
    },
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      setInteractionError(null);
      return interactionsApi.undo();
    },
    onSuccess: () => {
      setInteractedProfileIds(new Set());
      queryClient.invalidateQueries({ queryKey: DISCOVERY_QUERY_KEYS.feed });
    },
    onError: (err: Error) => {
      setInteractionError(err.message || 'Cannot undo');
    },
  });

  const allItems: DiscoveryItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages
      .flatMap((page) => page.items)
      .filter((item) => !interactedProfileIds.has(item.profile.id));
  }, [data, interactedProfileIds]);

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
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading discovery feed"
        >
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
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Refresh discovery feed"
          >
            <Text style={styles.primaryButtonText}>Refresh Feed</Text>
          </TouchableOpacity>
          {onOpenProfile ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onOpenProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile preferences"
            >
              <Text style={styles.secondaryButtonText}>Edit Preferences</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.undoButton, { marginTop: spacing.lg }]}
          onPress={() => undoMutation.mutate()}
          disabled={undoMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Undo last swipe"
        >
          <Text style={styles.undoButtonText}>↩ Undo Last Decision</Text>
        </TouchableOpacity>

        {/* Celebration Modal */}
        <MatchCelebrationModal
          visible={celebrationMatch !== null}
          matchedUser={celebrationMatch?.user || null}
          matchId={celebrationMatch?.matchId || null}
          onClose={() => setCelebrationMatch(null)}
          onViewMatches={onOpenMatches}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nazar</Text>
          <Text style={styles.headerSubtitle}>Social Discovery</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => undoMutation.mutate()}
            disabled={undoMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Undo last interaction"
            testID="discovery-undo-btn"
          >
            <Text style={styles.headerIconText}>↩</Text>
          </TouchableOpacity>

          {onOpenMatches && (
            <TouchableOpacity
              style={styles.headerMatchesBtn}
              onPress={onOpenMatches}
              accessibilityRole="button"
              accessibilityLabel="Open matches screen"
              testID="discovery-open-matches-btn"
            >
              <Text style={styles.headerMatchesText}>Matches 💬</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error banner if an interaction fails */}
      {interactionError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{interactionError}</Text>
          <TouchableOpacity onPress={() => setInteractionError(null)}>
            <Text style={styles.errorDismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.profile.id}
        renderItem={({ item }) => (
          <DiscoveryCard
            item={item}
            isSubmitting={submittingProfileId === item.profile.id}
            onPass={() => passMutation.mutate(item)}
            onLike={() => likeMutation.mutate(item)}
          />
        )}
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

      {/* Mutual Match Celebration Modal */}
      <MatchCelebrationModal
        visible={celebrationMatch !== null}
        matchedUser={celebrationMatch?.user || null}
        matchId={celebrationMatch?.matchId || null}
        onClose={() => setCelebrationMatch(null)}
        onViewMatches={onOpenMatches}
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    padding: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[800],
    fontWeight: 'bold',
  },
  headerMatchesBtn: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  headerMatchesText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold as '600',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    color: colors.status.error,
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  errorDismissText: {
    color: colors.status.error,
    fontSize: typography.fontSize.sm,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
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
  undoButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  undoButtonText: {
    color: colors.neutral[700],
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
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
