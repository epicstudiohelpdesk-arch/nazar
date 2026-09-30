import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type {
  CommunityMemberDto,
  CommunityMembershipStatus,
  CommunityRole,
} from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SocialPeopleList, type SocialPerson } from './components/SocialPeopleList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { invalidateCommunityLists } from './social-cache.js';
import { useProfileStore } from '../profile/profile-store.js';
import {
  byId,
  deriveMembershipView,
  flattenPages,
  getMutationErrorMessage,
  getNextCursorPageParam,
  getRoleLabel,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CommunityMembersScreenProps {
  readonly client: SocialApiClient;
  readonly communityId: string;
  /** Role/membership of the signed-in user, straight from the community DTO. */
  readonly currentUserRole?: CommunityRole | null;
  readonly currentUserMembershipStatus?: CommunityMembershipStatus | null;
  readonly currentUserId?: string | null;
  readonly onBack?: () => void;
}

const PAGE_SIZE = 20;

/**
 * Paginated community member roster.
 *
 * The API returns `ACTIVE` members only, ordered by `joinedAt DESC`. There is no
 * endpoint that lists `PENDING` members, so `approveMembership` cannot be reached
 * from a mobile screen yet. That gap is documented in
 * `docs/frontend/social-architecture.md` rather than worked around with a fake
 * requests tab.
 */
export const CommunityMembersScreen: React.FC<CommunityMembersScreenProps> = ({
  client,
  communityId,
  currentUserRole,
  currentUserMembershipStatus,
  currentUserId,
  onBack,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing } = useTheme();
  const [banError, setBanError] = useState<string | null>(null);
  const signedInUserId = useProfileStore((state) => state.profile?.userId ?? null);
  const viewerId = currentUserId ?? signedInUserId;

  // `community_members_viewed` fires on entry, not on member press, matching the
  // rest of the social funnel.
  useEffect(() => {
    if (communityId) {
      trackOnboardingEvent('community_members_viewed', { communityId });
    }
  }, [communityId]);

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.communityMembers(communityId),
    queryFn: ({ pageParam }) =>
      client.listCommunityMembers(communityId, { limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: Boolean(communityId),
  });

  const members = flattenPages(query.data?.pages, byId) as CommunityMemberDto[];

  // The viewer's own membership comes from the community DTO, never from the
  // fact that this screen is rendering.
  const membershipView = deriveMembershipView({
    currentUserRole: currentUserRole ?? null,
    currentUserMembershipStatus: currentUserMembershipStatus ?? null,
  });

  const banMutation = useMutation({
    mutationFn: (userId: string) => client.banMember(communityId, userId),
    onSuccess: () => {
      setBanError(null);
      // Member count and the roster both change; refetch rather than patch.
      invalidateCommunityLists(queryClient, communityId);
      trackOnboardingEvent('community_member_banned', {
        communityId,
        viewer_role: currentUserRole ?? 'UNKNOWN',
      });
    },
    onError: (error) => {
      const message = getMutationErrorMessage(error);
      setBanError(message);
      trackOnboardingEvent('community_member_ban_failed', { communityId, reason: message });
    },
  });

  const confirmBan = useCallback(
    (member: CommunityMemberDto) => {
      const name = member.user?.displayName || 'this member';
      Alert.alert(
        'Remove member?',
        `${name} will be removed from this community and will not be able to re-join.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              trackOnboardingEvent('community_member_ban_attempted', {
                communityId,
                target_role: member.role,
              });
              banMutation.mutate(member.userId);
            },
          },
        ]
      );
    },
    [banMutation, communityId]
  );

  const people: SocialPerson[] = members.map((member) => {
    // OWNER/ADMIN may moderate, but never themselves, and never the owner.
    const canBan =
      membershipView.canModerate &&
      !!viewerId &&
      member.userId !== viewerId &&
      member.role !== 'OWNER';
    return {
      id: member.id,
      userId: member.userId,
      displayName: member.user?.displayName ?? '',
      avatarUrl: member.user?.avatarUrl ?? null,
      badgeLabel: getRoleLabel(member.role),
      badgeVariant: member.role === 'OWNER' || member.role === 'ADMIN' ? 'accent' : 'neutral',
      action: canBan ? { label: 'Remove', onPress: () => confirmBan(member) } : undefined,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader title="Members" onBack={onBack} />
      {banError ? (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="members-ban-error"
        >
          <Text variant="caption" color="error">
            {banError}
          </Text>
        </View>
      ) : null}
      <SocialPeopleList
        people={people}
        isLoading={query.isLoading}
        isRefreshing={query.isRefetching && !query.isFetchingNextPage}
        isFetchingMore={query.isFetchingNextPage}
        hasMore={query.hasNextPage}
        error={query.error}
        onRefresh={() => void query.refetch()}
        onLoadMore={() => void query.fetchNextPage()}
        onRetry={() => void query.refetch()}
        onOpenProfile={(userId) => router.push(`/profile/${userId}`)}
        emptyTitle="No members to show"
        emptyDescription="Members will appear here once they join."
        loadingTestID="members-loading"
        listTestID="community-members"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
