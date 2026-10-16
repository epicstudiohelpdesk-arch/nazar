import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { InboundLikeItemDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { Button } from '../../design/components/button/Button.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { createInteractionsApi, INTERACTIONS_QUERY_KEYS } from '../interactions-api.js';
import { MATCHES_QUERY_KEYS } from '../../matches/matches-api.js';
import type { AuthClient } from '../../auth/auth-client.js';
import { trackOnboardingEvent } from '../../analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../design/responsive/index.js';
import { haptics } from '../../design/haptics/index.js';

export interface LikesYouGridProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: (userId: string) => void;
}

export const LikesYouGrid: React.FC<LikesYouGridProps> = ({ authClient, onOpenProfile }) => {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { maxContentWidth, width: screenWidth } = useResponsiveLayout();
  const effectiveWidth = Math.min(screenWidth, maxContentWidth);
  const columnWidth = Math.floor((effectiveWidth - 48) / 2);

  const interactionsApi = React.useMemo(() => createInteractionsApi(authClient), [authClient]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: INTERACTIONS_QUERY_KEYS.likesYou,
    queryFn: () => interactionsApi.getLikesYou(50),
  });

  const matchMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      haptics.selection();
      return interactionsApi.like(targetUserId);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: INTERACTIONS_QUERY_KEYS.likesYou });
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });
      if (res.matched) {
        haptics.notificationSuccess();
        Alert.alert('It’s a Match!', 'You mutually liked each other. Start the conversation now!');
      }
    },
    onError: (err: unknown) => {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Failed to match';
      Alert.alert('Error', msg);
    },
  });

  const passMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      haptics.selection();
      return interactionsApi.pass(targetUserId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INTERACTIONS_QUERY_KEYS.likesYou });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to pass';
      Alert.alert('Error', msg);
    },
  });

  const hasEntitlement = data?.hasEntitlement ?? false;
  const totalCount = data?.totalCount ?? 0;
  const items = data?.items ?? [];

  const handleCardPress = (item: InboundLikeItemDto) => {
    haptics.selection();
    if (!hasEntitlement) {
      trackOnboardingEvent('premium_feature_locked', {
        feature: 'SEE_WHO_LIKED_YOU',
        surface: 'likes_you_grid',
      });
      router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/matches');
      return;
    }

    if (item.profile && onOpenProfile) {
      onOpenProfile(item.profile.userId);
    }
  };

  const renderItem = ({ item }: { item: InboundLikeItemDto }) => {
    const isBlurred = item.isBlurred;
    const photo = isBlurred ? item.blurredPhotoUrl : item.profile?.photoUrl;
    const fallbackPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';

    return (
      <TouchableOpacity
        style={[styles.card, { width: columnWidth, borderColor: theme.colors.border }]}
        activeOpacity={0.85}
        onPress={() => handleCardPress(item)}
      >
        <Image
          source={{ uri: photo || fallbackPhoto }}
          style={styles.cardImage}
          blurRadius={isBlurred ? 24 : 0}
          resizeMode="cover"
        />

        {/* Gradient / Dark overlay at bottom */}
        <View style={styles.cardOverlay}>
          {isBlurred ? (
            <View style={styles.lockedContainer}>
              <View style={[styles.lockBadge, { backgroundColor: theme.colors.accentSoft }]}>
                <Icon name="lock" size={16} color={theme.colors.accent} />
              </View>
              <Text level="caption" style={styles.lockedText}>
                Liked You
              </Text>
            </View>
          ) : (
            <View style={styles.profileDetails}>
              <View style={styles.nameRow}>
                <Text level="title" style={styles.nameText} numberOfLines={1}>
                  {item.profile?.displayName}, {item.profile?.age}
                </Text>
                {item.profile?.isVerified && (
                  <Icon name="shield" size={14} color={theme.colors.success} />
                )}
              </View>

              {item.profile?.city && (
                <Text level="caption" style={styles.cityText} numberOfLines={1}>
                  {item.profile.city}
                </Text>
              )}

              {item.comment && (
                <View style={[styles.commentBubble, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                  <Text level="caption" numberOfLines={2} style={styles.commentText}>
                    "{item.comment}"
                  </Text>
                </View>
              )}

              {/* Instant Match / Pass buttons */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.miniCircleBtn, { backgroundColor: theme.colors.surfaceMuted }]}
                  onPress={() => passMutation.mutate(item.actorUserId)}
                  disabled={passMutation.isPending}
                >
                  <Icon name="close" size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniCircleBtn, { backgroundColor: theme.colors.accent }]}
                  onPress={() => matchMutation.mutate(item.actorUserId)}
                  disabled={matchMutation.isPending}
                >
                  <Icon name="heart" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && !isRefetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
          Checking inbound likes...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Paywall Banner if Free Tier */}
      {!hasEntitlement && (
        <SurfaceCard
          style={[
            styles.paywallTeaser,
            {
              borderColor: theme.colors.accentSoft,
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
        >
          <View style={styles.teaserContent}>
            <View style={[styles.goldIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="sparkles" size={20} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Heading level="title" style={{ color: theme.colors.accent }}>
                {totalCount > 0 ? `${totalCount} People Liked You` : 'Likes You Grid'}
              </Heading>
              <Text level="caption" color="secondary" style={{ marginTop: 2 }}>
                Upgrade to Nazar Gold to unblur all profiles and match instantly.
              </Text>
            </View>
          </View>
          <Button
            label="Reveal All Likes"
            variant="primary"
            size="sm"
            icon="sparkles"
            onPress={() => {
              haptics.selection();
              router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/matches');
            }}
            style={{ marginTop: 10 }}
          />
        </SurfaceCard>
      )}

      {/* Grid List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={[
          styles.listContent,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        columnWrapperStyle={styles.columnWrapper}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="heart" size={36} color={theme.colors.textTertiary} />
            <Heading level="title" style={{ marginTop: 12, textAlign: 'center' }}>
              No Inbound Likes Yet
            </Heading>
            <Text level="bodySmall" color="secondary" style={{ marginTop: 6, textAlign: 'center' }}>
              As more members discover your profile, your likes will appear here.
            </Text>
          </View>
        }
      />
    </View>
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
    padding: 32,
  },
  paywallTeaser: {
    margin: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  teaserContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goldIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  lockedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  profileDetails: {
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  cityText: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  commentBubble: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  commentText: {
    fontSize: 10,
    color: '#1E293B',
    fontStyle: 'italic',
  },
  actionBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  miniCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
});
