import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { DiscoveryItemDto, DiscoveryResponseDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/ThemeContext.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { Heading } from '../design/primitives/Heading.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { IconButton } from '../design/components/button/IconButton.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { ProfileCard, type ProfileCardData } from '../design/components/card/ProfileCard.js';
import { createDiscoveryApi, DISCOVERY_QUERY_KEYS } from './discovery-api.js';
import { createInteractionsApi } from '../interactions/interactions-api.js';
import { MATCHES_QUERY_KEYS } from '../matches/matches-api.js';
import type { AuthClient } from '../auth/auth-client.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { useFeatureGate } from '../billing/useEntitlements.js';
import { haptics } from '../design/haptics/index.js';
import { announceAccessibility, ensureMinTouchTarget } from '../design/a11y/index.js';
import { useReducedMotion } from '../design/motion/index.js';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

export interface DiscoveryScreenProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: (userId: string) => void;
  readonly onOpenMatches?: () => void;
  readonly onOpenFilters?: () => void;
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = ({
  authClient,
  onOpenProfile,
  onOpenMatches,
  onOpenFilters,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { isUnlocked: hasRewinds } = useFeatureGate('UNLIMITED_REWINDS');
  const isReduced = useReducedMotion();

  const discoveryApi = useMemo(() => createDiscoveryApi(authClient), [authClient]);
  const interactionsApi = useMemo(() => createInteractionsApi(authClient), [authClient]);

  // Pointer into current candidate stack
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animated swipe tracking
  const position = useRef(new Animated.ValueXY()).current;

  // Infinite query for discovery feed
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

  // Track discovery feed view analytics
  useEffect(() => {
    trackOnboardingEvent('discovery_viewed');
  }, []);

  // Deduplicate candidates across infinite pagination pages
  const candidates: DiscoveryItemDto[] = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: DiscoveryItemDto[] = [];

    for (const page of data.pages) {
      for (const item of page.items) {
        const id = item.profile.userId || item.profile.id;
        if (!seen.has(id)) {
          seen.add(id);
          list.push(item);
        }
      }
    }
    return list;
  }, [data]);

  const activeCandidate = candidates[currentIndex];
  const nextCandidate = candidates[currentIndex + 1];

  // Prefetch next page as user nears end of visible deck
  useEffect(() => {
    if (candidates.length - currentIndex <= 3 && hasNextPage && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [currentIndex, candidates.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Fire candidate impression when active card changes
  useEffect(() => {
    if (activeCandidate) {
      trackOnboardingEvent('candidate_impression', {
        candidateId: activeCandidate.profile.userId || activeCandidate.profile.id,
      });
      announceAccessibility(
        `Viewing profile: ${activeCandidate.profile.displayName}, age ${activeCandidate.profile.age || ''}, ${activeCandidate.profile.city || ''}`
      );
    }
  }, [activeCandidate]);

  // LIKE Mutation
  const likeMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return interactionsApi.like(targetUserId);
    },
    onSuccess: (res, targetUserId) => {
      trackOnboardingEvent('like_sent', { targetUserId, matched: res.matched });
      if (res.matched && res.matchId) {
        trackOnboardingEvent('match_created', { matchId: res.matchId });
        queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });

        // Navigate to match celebration modal
        const candidateName = activeCandidate?.profile.displayName || 'Your Match';
        router.push(
          `/modal/celebration?matchId=${res.matchId}&targetUserId=${targetUserId}&userName=${encodeURIComponent(candidateName)}`
        );
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Like action failed';
      setErrorMessage(msg);
      // Revert active index so candidate is not silently dropped
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // PASS Mutation
  const passMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return interactionsApi.pass(targetUserId);
    },
    onSuccess: (_, targetUserId) => {
      trackOnboardingEvent('pass_sent', { targetUserId });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Pass action failed';
      setErrorMessage(msg);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Action handlers
  const handleLike = () => {
    if (!activeCandidate || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    haptics.medium();

    const targetUserId = activeCandidate.profile.userId || activeCandidate.profile.id;

    // Optimistically advance index
    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });

    likeMutation.mutate(targetUserId);
  };

  const handlePass = () => {
    if (!activeCandidate || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    haptics.selection();

    const targetUserId = activeCandidate.profile.userId || activeCandidate.profile.id;

    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });

    passMutation.mutate(targetUserId);
  };

  const handleUndo = async () => {
    if (currentIndex <= 0 || isSubmitting) return;
    if (!hasRewinds) {
      trackOnboardingEvent('premium_feature_locked', {
        feature: 'UNLIMITED_REWINDS',
        surface: 'discovery_undo',
      });
      Alert.alert(
        'Nazar Premium Feature',
        'Rewinding your last pass or like requires Nazar Premium. Upgrade to unlock unlimited rewinds.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/discovery'),
          },
        ]
      );
      return;
    }
    setIsSubmitting(true);
    haptics.selection();
    try {
      await interactionsApi.undo();
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Undo failed';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = (userId: string) => {
    trackOnboardingEvent('profile_opened', { targetUserId: userId });
    if (onOpenProfile) {
      onOpenProfile(userId);
    } else {
      router.push(`/profile/${userId}`);
    }
  };

  // PanResponder for card gesture swiping
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSubmitting,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 10 && !isSubmitting;
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.2 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          if (isReduced) {
            handleLike();
          } else {
            Animated.timing(position, {
              toValue: { x: SCREEN_WIDTH + 100, y: gesture.dy },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handleLike();
            });
          }
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          if (isReduced) {
            handlePass();
          } else {
            Animated.timing(position, {
              toValue: { x: -SCREEN_WIDTH - 100, y: gesture.dy },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handlePass();
            });
          }
        } else {
          if (isReduced) {
            position.setValue({ x: 0, y: 0 });
          } else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              friction: 5,
              useNativeDriver: true,
            }).start();
          }
        }
      },
    })
  ).current;

  // Transform interpolation for rotation during swipe
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const likeBadgeOpacity = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passBadgeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Convert DiscoveryItemDto to ProfileCardData format
  const formatProfileData = (item: DiscoveryItemDto): ProfileCardData => {
    const { profile, distanceBucket } = item;
    const mediaUrls = (profile.media || []).map((m) => m.url);
    const primary = profile.media?.find((m) => m.isPrimary)?.url || mediaUrls[0] || null;

    return {
      id: profile.userId || profile.id,
      name: profile.displayName,
      age: profile.age,
      city: profile.city || undefined,
      country: profile.countryCode || undefined,
      contextualInfo: distanceBucket ? `${distanceBucket} away` : undefined,
      bio: profile.bio || undefined,
      occupation: profile.occupation || undefined,
      education: profile.education || undefined,
      imageUrl: primary,
      images: mediaUrls,
      imageCount: mediaUrls.length,
      isVerified: true,
      interests: (profile.interests || []).map((i) => i.name),
      prompts: (profile.prompts || []).map((p) => ({
        question: p.prompt,
        answer: p.answer,
      })),
    };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <TopNavHeader
        title="Nazar"
        leftAction="none"
        rightAction={
          <View style={styles.headerActions}>
            <IconButton
              icon="filter"
              size="md"
              variant="tertiary"
              accessibilityLabel="Open discovery filters"
              onPress={() => {
                trackOnboardingEvent('filter_opened');
                if (onOpenFilters) {
                  onOpenFilters();
                } else {
                  router.push('/modal/filters');
                }
              }}
            />
            <IconButton
              icon="heart"
              size="md"
              variant="tertiary"
              accessibilityLabel="View matches"
              onPress={() => {
                if (onOpenMatches) {
                  onOpenMatches();
                } else {
                  router.push('/(tabs)/matches');
                }
              }}
            />
          </View>
        }
      />

      {/* Inline Error Notice */}
      {errorMessage && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error },
          ]}
        >
          <Text level="caption" style={{ color: theme.colors.error, fontWeight: '600' }}>
            {errorMessage}
          </Text>
        </View>
      )}

      {/* Main Deck Container */}
      <View style={styles.deckContainer}>
        {isLoading && candidates.length === 0 ? (
          // Loading Skeleton State
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
              Curating thoughtful profiles...
            </Text>
          </View>
        ) : isError && candidates.length === 0 ? (
          // Error State
          <View style={styles.centerContainer}>
            <Icon name="warning" size="lg" color={theme.colors.warning} />
            <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
              Unable to load feed
            </Heading>
            <Text level="body" color="secondary" style={styles.messageText}>
              {error?.message || 'Check your network connection and try again.'}
            </Text>
            <Button
              variant="secondary"
              size="md"
              onPress={() => refetch()}
              style={{ marginTop: 16 }}
              accessibilityLabel="Retry loading discovery feed"
            >
              Retry
            </Button>
          </View>
        ) : !activeCandidate ? (
          // Empty State (All Candidates Evaluated)
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
              <Icon name="sparkles" size="lg" color={theme.colors.accent} />
            </View>
            <Heading level="h2" style={{ textAlign: 'center', marginTop: 12 }}>
              You've Caught Up!
            </Heading>
            <Text level="body" color="secondary" style={styles.messageText}>
              No more profiles matching your current filters right now. Expand your distance or age
              preferences to meet more people.
            </Text>

            <View style={styles.emptyActions}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onPress={() => router.push('/modal/filters')}
                accessibilityLabel="Adjust discovery preferences"
              >
                Adjust Preferences
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                isLoading={isRefetching}
                onPress={() => refetch()}
                accessibilityLabel="Refresh discovery feed"
              >
                Refresh Feed
              </Button>
            </View>
          </SurfaceCard>
        ) : (
          // Active Deck with Swipable Top Card and Underneath Card
          <View style={styles.cardsStack}>
            {/* Underneath Next Card (Visual depth) */}
            {nextCandidate && (
              <View style={[styles.cardWrapper, styles.nextCardWrapper]}>
                <ProfileCard context="discovery" profile={formatProfileData(nextCandidate)} />
              </View>
            )}

            {/* Top Swipable Card */}
            <Animated.View
              style={[
                styles.cardWrapper,
                styles.activeCardWrapper,
                {
                  transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Swipe Overlay Badges */}
              <Animated.View
                style={[
                  styles.swipeBadge,
                  styles.likeBadge,
                  { opacity: likeBadgeOpacity, borderColor: theme.colors.accent },
                ]}
              >
                <Text level="title" style={{ color: theme.colors.accent, fontWeight: '800' }}>
                  LIKE 💕
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.swipeBadge,
                  styles.passBadge,
                  { opacity: passBadgeOpacity, borderColor: theme.colors.textTertiary },
                ]}
              >
                <Text level="title" style={{ color: theme.colors.textTertiary, fontWeight: '800' }}>
                  PASS ✕
                </Text>
              </Animated.View>

              <ProfileCard
                context="discovery"
                profile={formatProfileData(activeCandidate)}
                onPress={() =>
                  handleOpenDetail(activeCandidate.profile.userId || activeCandidate.profile.id)
                }
              />
            </Animated.View>
          </View>
        )}
      </View>

      {/* Bottom Accessible Action Bar */}
      {activeCandidate && (
        <View style={styles.bottomActionBar}>
          {/* Undo Button */}
          <TouchableOpacity
            style={[
              styles.actionCircle,
              styles.undoButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: currentIndex > 0 ? 1 : 0.4,
              },
            ]}
            onPress={handleUndo}
            disabled={currentIndex === 0 || isSubmitting}
            hitSlop={ensureMinTouchTarget(44, 44)}
            accessibilityRole="button"
            accessibilityLabel="Undo last pass or like"
            testID="discovery-undo-btn"
          >
            <Icon name="chevron" direction="left" size="sm" color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Pass Button */}
          <TouchableOpacity
            style={[
              styles.actionCircle,
              styles.passCircle,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handlePass}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={`Pass on ${activeCandidate.profile.displayName}`}
            testID="discovery-pass-btn"
          >
            <Icon name="close" size="md" color={theme.colors.error} />
          </TouchableOpacity>

          {/* Info / Profile Detail Button */}
          <TouchableOpacity
            style={[
              styles.actionCircle,
              styles.infoCircle,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() =>
              handleOpenDetail(activeCandidate.profile.userId || activeCandidate.profile.id)
            }
            hitSlop={ensureMinTouchTarget(44, 44)}
            accessibilityRole="button"
            accessibilityLabel={`View full profile for ${activeCandidate.profile.displayName}`}
            testID="discovery-info-btn"
          >
            <Icon name="chevron" direction="up" size="sm" color={theme.colors.textPrimary} />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity
            style={[
              styles.actionCircle,
              styles.likeCircle,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.accent,
              },
            ]}
            onPress={handleLike}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={`Like ${activeCandidate.profile.displayName}`}
            testID="discovery-like-btn"
          >
            <Icon name="heart" size="md" color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorBanner: {
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  messageText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 340,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: {
    width: '100%',
    gap: 10,
    marginTop: 24,
  },
  cardsStack: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: '100%',
    maxWidth: 420,
  },
  nextCardWrapper: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.75,
  },
  activeCardWrapper: {
    zIndex: 10,
  },
  swipeBadge: {
    position: 'absolute',
    top: 36,
    zIndex: 20,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  likeBadge: {
    left: 24,
    transform: [{ rotate: '-15deg' }],
  },
  passBadge: {
    right: 24,
    transform: [{ rotate: '15deg' }],
  },
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  actionCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  undoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  passCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  infoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  likeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
