import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { MatchItemDto, MatchListResponseDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/ThemeContext.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { Heading } from '../design/primitives/Heading.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { IconButton } from '../design/components/button/IconButton.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { MatchCard } from '../design/components/card/MatchCard.js';
import { createMatchesApi, MATCHES_QUERY_KEYS } from './matches-api.js';
import type { AuthClient } from '../auth/auth-client.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { PremiumGate } from '../billing/PremiumGate.js';

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
  const router = useRouter();
  const { theme } = useTheme();
  const matchesApi = useMemo(() => createMatchesApi(authClient), [authClient]);

  const [searchQuery, setSearchQuery] = useState('');

  // Infinite Query for Matches
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

  // Track matches viewed event on mount
  useEffect(() => {
    trackOnboardingEvent('matches_viewed');
  }, []);

  // Deduplicate matches across pagination pages
  const allMatches: MatchItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: MatchItemDto[] = [];

    for (const page of data.pages) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  }, [data]);

  // Filter matches by local search query
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return allMatches;
    const q = searchQuery.toLowerCase().trim();
    return allMatches.filter((m) => {
      const name = m.otherUser.displayName.toLowerCase();
      const city = (m.otherUser.city || '').toLowerCase();
      return name.includes(q) || city.includes(q);
    });
  }, [allMatches, searchQuery]);

  const handleSelectMatch = (matchId: string) => {
    trackOnboardingEvent('match_opened', { matchId });
    if (onSelectMatch) {
      onSelectMatch(matchId);
    } else {
      router.push(`/matches/${matchId}`);
    }
  };

  const handleExploreDiscovery = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/(tabs)/discovery');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <TopNavHeader
        title="Matches"
        subtitle={
          allMatches.length > 0
            ? `${allMatches.length} mutual connection${allMatches.length === 1 ? '' : 's'}`
            : undefined
        }
        leftAction={onBack ? 'back' : 'none'}
        onBack={onBack}
        rightAction={
          <IconButton
            icon="refresh"
            size="md"
            variant="tertiary"
            accessibilityLabel="Refresh matches list"
            onPress={() => refetch()}
            testID="matches.refresh-btn"
          />
        }
      />

      {/* Loading Skeleton */}
      {isLoading && allMatches.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading mutual connections...
          </Text>
        </View>
      ) : isError && allMatches.length === 0 ? (
        // Error State
        <View style={styles.centerContainer}>
          <Icon name="warning" size="lg" color={theme.colors.warning} />
          <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
            Unable to load matches
          </Heading>
          <Text level="body" color="secondary" style={styles.messageText}>
            {error?.message || 'Check your network connection and try again.'}
          </Text>
          <Button
            variant="secondary"
            size="md"
            onPress={() => refetch()}
            style={{ marginTop: 16 }}
            accessibilityLabel="Retry loading matches"
            testID="matches.retry-btn"
          >
            Retry
          </Button>
        </View>
      ) : allMatches.length === 0 ? (
        // Empty State
        <View style={styles.emptyContainer}>
          <SurfaceCard
            elevation="none"
            style={[styles.emptyCard, { borderColor: theme.colors.border }]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
              ]}
            >
              <Icon name="heart" size="lg" color={theme.colors.accent} />
            </View>
            <Heading level="h2" style={{ textAlign: 'center', marginTop: 14 }}>
              Your connections start here
            </Heading>
            <Text level="body" color="secondary" style={styles.messageText}>
              When you and another member mutually like each other, your connections will appear
              here. Keep exploring profiles!
            </Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              style={{ marginTop: 24 }}
              onPress={handleExploreDiscovery}
              accessibilityLabel="Explore discovery feed"
              testID="matches.explore-btn"
            >
              Explore Discovery ✨
            </Button>
          </SurfaceCard>
        </View>
      ) : (
        // Matches List
        <View style={styles.listWrapper}>
          <View style={styles.premiumBannerWrapper}>
            <PremiumGate
              feature="SEE_LIKES"
              lockedTitle="See Who Liked You"
              lockedMessage="Unlock Nazar Premium to reveal members who liked you and match with them instantly."
              onUnlockPress={() =>
                router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/matches')
              }
            >
              <SurfaceCard elevation="sm" style={styles.unlockedLikesCard}>
                <View style={styles.unlockedLikesRow}>
                  <View style={[styles.badgeIcon, { backgroundColor: theme.colors.accentSoft }]}>
                    <Icon name="sparkles" size="md" color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text level="title" weight="bold">
                      See Who Liked You Active
                    </Text>
                    <Text level="bodySmall" color="secondary">
                      Incoming likes are prioritized in your discovery feed and match queue.
                    </Text>
                  </View>
                </View>
              </SurfaceCard>
            </PremiumGate>
          </View>

          {/* Search Filter Input */}
          <View style={styles.searchContainer}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Icon name="search" size="sm" color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.textPrimary }]}
                placeholder="Search matches by name or city..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                accessibilityLabel="Filter matches by name or city"
                testID="matches.search-input"
              />
            </View>
          </View>

          <FlatList
            data={filteredMatches}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            testID="matches.list"
            renderItem={({ item }) => {
              const { otherUser, matchedAt } = item;
              const formattedDate = new Date(matchedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <MatchCard
                  id={item.id}
                  name={otherUser.displayName}
                  age={otherUser.age}
                  avatarUrl={otherUser.primaryPhotoUrl}
                  matchedAt={formattedDate}
                  onPress={() => handleSelectMatch(item.id)}
                  testID={`matches.item.${item.id}`}
                />
              );
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                void fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text level="caption" color="secondary" style={{ marginTop: 6 }}>
                    Loading more connections...
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  listWrapper: {
    flex: 1,
  },
  premiumBannerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  unlockedLikesCard: {
    padding: 16,
    borderRadius: 16,
  },
  unlockedLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
