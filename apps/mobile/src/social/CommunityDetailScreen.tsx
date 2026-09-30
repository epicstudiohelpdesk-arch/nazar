import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type {
  CommunityDto,
  EventDto,
  PostDto,
  ReportReasonCode,
  ReportTargetType,
} from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Heading } from '../design/primitives/Heading.js';
import { Badge } from '../design/primitives/Badge.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { EventCard } from '../design/components/card/EventCard.js';
import { SocialPostList } from './components/SocialPostList.js';
import { ReportModal } from '../safety/components/ReportModal.js';
import { createSafetyApi } from '../safety/safety-api.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { invalidateCommunityLists } from './social-cache.js';
import { CreateCommunityScreen } from './CreateCommunityScreen.js';
import {
  byId,
  deriveMembershipView,
  describeCommunityForScreenReader,
  describeSocialError,
  flattenPages,
  formatEventDateLabel,
  getMutationErrorMessage,
  getJoinOutcomeLabel,
  getNextCursorPageParam,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CommunityDetailScreenProps {
  readonly client: SocialApiClient;
  readonly communityId: string;
  readonly onBack?: () => void;
}

type CommunityTab = 'feed' | 'events' | 'about';

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Approval required',
  HIDDEN: 'Unlisted',
};

export const CommunityDetailScreen: React.FC<CommunityDetailScreenProps> = ({
  client,
  communityId,
  onBack,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, radii, spacing } = useTheme();

  const [activeTab, setActiveTab] = useState<CommunityTab>('feed');
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authClient = useMemo(() => getDefaultAuthClient(), []);
  const safetyApi = useMemo(() => createSafetyApi(authClient), [authClient]);

  const {
    data: community,
    isLoading: isLoadingCommunity,
    error: communityError,
    refetch: refetchCommunity,
  } = useQuery<CommunityDto>({
    queryKey: SOCIAL_QUERY_KEYS.community(communityId),
    queryFn: () => client.getCommunity(communityId),
    enabled: Boolean(communityId),
  });

  const feedQuery = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.communityFeed(communityId),
    queryFn: ({ pageParam }) =>
      client.getCommunityFeed(communityId, { limit: 15, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: activeTab === 'feed' && Boolean(communityId),
  });

  const eventsQuery = useQuery({
    queryKey: SOCIAL_QUERY_KEYS.events({ communityId }),
    queryFn: () => client.discoverEvents({ communityId, limit: 20 }),
    enabled: activeTab === 'events' && Boolean(communityId),
  });

  useEffect(() => {
    if (community) {
      trackOnboardingEvent('community_viewed', { communityId: community.id });
    }
  }, [community, communityId]);

  useEffect(() => {
    if (activeTab === 'feed') {
      trackOnboardingEvent('community_feed_viewed', { communityId });
    }
  }, [activeTab, communityId]);

  const membershipView = deriveMembershipView(community ?? {});

  const joinMutation = useMutation({
    mutationFn: () => client.joinCommunity(communityId),
    onSuccess: (res) => {
      setMembershipError(null);
      setNotice(getJoinOutcomeLabel(res.status));
      trackOnboardingEvent(
        res.status === 'PENDING' ? 'community_join_requested' : 'community_joined',
        { communityId }
      );
      void invalidateCommunityMembership(communityId);
    },
    onError: (error) => setMembershipError(getMutationErrorMessage(error)),
  });

  const leaveMutation = useMutation({
    mutationFn: () => client.leaveCommunity(communityId),
    onSuccess: () => {
      setMembershipError(null);
      setNotice('You have left this community.');
      trackOnboardingEvent('community_left', { communityId });
      void invalidateCommunityMembership(communityId);
    },
    onError: (error) => setMembershipError(getMutationErrorMessage(error)),
  });

  const invalidateCommunityMembership = (id: string) => {
    invalidateCommunityLists(queryClient, id);
  };

  const onPrimaryMembershipPress = () => {
    setNotice(null);
    switch (membershipView.action) {
      case 'join':
        trackOnboardingEvent('community_join_attempted', { communityId });
        joinMutation.mutate();
        break;
      case 'leave':
        // Leaving is destructive and cannot be undone without re-joining, so it
        // always requires explicit confirmation.
        Alert.alert(
          'Leave community?',
          `You will lose access to posts in ${community?.name ?? 'this community'}. You can re-join later if the community allows it.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => {
                trackOnboardingEvent('community_leave_attempted', { communityId });
                leaveMutation.mutate();
              },
            },
          ]
        );
        break;
      default:
        // PENDING and BANNED are terminal states from the viewer's side.
        break;
    }
  };

  const handleReportSubmit = async (data: {
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: ReportReasonCode;
    notes?: string;
  }) => {
    await safetyApi.createReport({
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      description: data.notes || null,
    });
    setIsReportModalVisible(false);
    trackOnboardingEvent('social_report_submitted', {
      targetType: 'COMMUNITY',
      reasonCode: data.reasonCode,
    });
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  if (isLoadingCommunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Community" onBack={handleBack} />
      </View>
    );
  }

  if (communityError || !community) {
    const view = describeSocialError(communityError);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Community" onBack={handleBack} />
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={view.isRetryable ? () => void refetchCommunity() : undefined}
          testID="community-detail-error"
        />
      </View>
    );
  }

  const posts = flattenPages(feedQuery.data?.pages, byId) as PostDto[];
  const events = (eventsQuery.data?.items ?? []) as EventDto[];
  const isMembershipPending = joinMutation.isPending || leaveMutation.isPending;

  const renderEvent = ({ item }: { item: EventDto }) => (
    <View style={{ marginBottom: spacing.md }}>
      <EventCard
        id={item.id}
        title={item.title}
        dateFormatted={formatEventDateLabel(item.startAt)}
        location={item.type === 'ONLINE' ? 'Online' : item.locationName}
        attendeeCount={item.attendeeCount}
        rsvpStatus={item.currentUserRsvp === 'GOING' ? 'attending' : null}
        onPress={() => router.push(socialRoutes.event(item.id))}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title={community.name}
        onBack={handleBack}
        rightAction={
          <TouchableOpacity
            onPress={() => setIsReportModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Report this community"
            accessibilityHint="Opens the report form"
            testID="community-report-btn"
          >
            <Text variant="caption" weight="bold" color="error">
              Report
            </Text>
          </TouchableOpacity>
        }
      />

      <View
        style={[
          styles.heroSection,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            padding: spacing.md,
          },
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={describeCommunityForScreenReader(community)}
      >
        <View style={styles.titleRow}>
          <Heading level="h2" style={styles.flexOne}>
            {community.name}
          </Heading>
          <Badge
            label={PRIVACY_LABELS[community.privacy] ?? community.privacy}
            variant={community.privacy === 'PUBLIC' ? 'success' : 'neutral'}
            size="sm"
          />
        </View>

        <Text variant="bodySmall" color="secondary" style={{ marginTop: spacing.xs }}>
          {community.description}
        </Text>

        <View style={styles.metaRow}>
          <Text variant="caption" color="tertiary">
            {community.memberCount} members
          </Text>
          {membershipView.role ? (
            <Text variant="caption" color="tertiary">
              {'  \u00b7  '}
              {membershipView.role.charAt(0) + membershipView.role.slice(1).toLowerCase()}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            label={membershipView.primaryActionLabel}
            variant={membershipView.action === 'leave' ? 'secondary' : 'primary'}
            onPress={onPrimaryMembershipPress}
            disabled={
              isMembershipPending ||
              membershipView.action === 'pending' ||
              membershipView.action === 'banned'
            }
            loading={isMembershipPending}
            fullWidth
            accessibilityHint={membershipView.primaryActionHint}
            testID="community-membership-btn"
          />
          {membershipView.action === 'pending' ? (
            <Text variant="caption" color="secondary" align="center">
              A moderator still needs to approve your request.
            </Text>
          ) : null}
          {membershipView.action === 'banned' ? (
            <Text variant="caption" color="error" align="center">
              You cannot re-join this community.
            </Text>
          ) : null}
        </View>

        {membershipError ? (
          <View
            style={[
              styles.inlineNotice,
              {
                backgroundColor: colors.errorSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="community-membership-error"
          >
            <Text variant="caption" color="error">
              {membershipError}
            </Text>
          </View>
        ) : null}
        {notice ? (
          <View
            style={[
              styles.inlineNotice,
              {
                backgroundColor: colors.successSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="community-membership-notice"
          >
            <Text variant="caption" color="success">
              {notice}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        accessibilityRole="tablist"
      >
        {(
          [
            ['feed', 'Feed'],
            ['events', 'Events'],
            ['about', 'About'],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              activeTab === key && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === key }}
            accessibilityLabel={label}
            testID={`community-tab-${key}`}
          >
            <Text
              variant="caption"
              weight={activeTab === key ? 'bold' : 'medium'}
              color={activeTab === key ? 'accent' : 'secondary'}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'feed' ? (
        <SocialPostList
          posts={posts}
          isLoading={feedQuery.isLoading}
          isRefreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
          isFetchingMore={feedQuery.isFetchingNextPage}
          hasMore={feedQuery.hasNextPage}
          error={feedQuery.error}
          onRefresh={() => void feedQuery.refetch()}
          onEndReached={() => void feedQuery.fetchNextPage()}
          onRetry={() => void feedQuery.refetch()}
          onOpenPost={(post) => router.push(socialRoutes.post(post.id))}
          emptyTitle="No posts here yet"
          emptyDescription={
            membershipView.isMember
              ? 'Be the first to share something with this community.'
              : 'Join this community to see and share posts.'
          }
          emptyActionLabel={
            membershipView.canCreatePost ? 'Create a post' : 'View community details'
          }
          onEmptyAction={() =>
            membershipView.canCreatePost
              ? router.push(socialRoutes.createPost(communityId))
              : setActiveTab('about')
          }
          testID="community-feed"
        />
      ) : activeTab === 'events' ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={events.length === 0 ? styles.emptyListContent : styles.feedContent}
          refreshing={eventsQuery.isRefetching}
          onRefresh={() => void eventsQuery.refetch()}
          ListEmptyComponent={
            eventsQuery.isLoading ? null : (
              <EmptyState
                type="noEvents"
                title="No upcoming events"
                description="This community has nothing scheduled right now."
                actionLabel="Host an event"
                onAction={() => router.push(socialRoutes.createEvent(communityId))}
                testID="community-events-empty"
              />
            )
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <Heading level="title" style={{ marginBottom: spacing.xs }}>
            About
          </Heading>
          <Text variant="body" color="secondary" style={{ marginBottom: spacing.lg }}>
            {community.description}
          </Text>

          <Button
            label={`View all members (${community.memberCount})`}
            onPress={() => router.push(socialRoutes.communityMembers(communityId))}
            variant="secondary"
            size="sm"
            fullWidth
            style={{ marginBottom: membershipView.canModerate ? spacing.sm : spacing.lg }}
            accessibilityHint="Opens the full member list"
            testID="community-members-link"
          />

          {/* The API authorises PATCH /communities/:id for OWNER and ADMIN with an
              ACTIVE membership, which is exactly what `canModerate` already
              encodes. */}
          {membershipView.canModerate ? (
            <Button
              label="Edit community"
              onPress={() => {
                setMembershipError(null);
                setIsEditing(true);
              }}
              variant="tertiary"
              size="sm"
              fullWidth
              style={{ marginBottom: spacing.lg }}
              accessibilityHint="Edit the name, description, joining rules and privacy"
              testID="community-edit-btn"
            />
          ) : null}

          {community.rules && community.rules.length > 0 ? (
            <View>
              <Heading level="title" style={{ marginBottom: spacing.sm }}>
                Community rules
              </Heading>
              {community.rules.map((rule, idx) => (
                <View
                  key={`${idx}-${rule.slice(0, 12)}`}
                  style={[
                    styles.ruleCard,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      borderRadius: radii.radiusMD,
                      padding: spacing.sm,
                      marginBottom: spacing.xs,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`Rule ${idx + 1}: ${rule}`}
                >
                  <Text variant="caption" weight="bold" color="accent">
                    Rule {idx + 1}
                  </Text>
                  <Text variant="bodySmall" style={{ marginTop: 2 }}>
                    {rule}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="caption" color="tertiary">
              This community has not published any rules.
            </Text>
          )}
        </ScrollView>
      )}

      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditing(false)}
        testID="community-edit-modal"
      >
        <CreateCommunityScreen
          client={client}
          editing={community}
          onCancel={() => setIsEditing(false)}
          onCreated={() => setIsEditing(false)}
        />
      </Modal>

      <ReportModal
        visible={isReportModalVisible}
        targetType="COMMUNITY"
        targetId={community.id}
        targetName={community.name}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  heroSection: {
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  inlineNotice: {
    width: '100%',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ruleCard: {
    borderWidth: 1,
  },
});
