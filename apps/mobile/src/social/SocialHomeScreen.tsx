import React, { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { CommunityDto, EventDto, PostDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Heading } from '../design/primitives/Heading.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { CommunityCard } from '../design/components/card/CommunityCard.js';
import { EventCard } from '../design/components/card/EventCard.js';
import { PostCard } from '../design/patterns/social/index.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import {
  describeCommunityForScreenReader,
  describeEventForScreenReader,
  describeSocialError,
  formatEventDateLabel,
  formatRelativeTime,
  socialRoutes,
  toEventCardRsvp,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';

export interface SocialHomeScreenProps {
  readonly client: SocialApiClient;
}

const PREVIEW_LIMIT = 5;

/**
 * Curated social landing surface for the Explore tab.
 *
 * The previous implementation rendered the global post feed directly, so the
 * tab had no identity of its own and communities/events were only reachable
 * through a nested tab. This screen leads with a short, server-ordered preview
 * of each surface and delegates the full, paginated lists to their own routes.
 *
 * Every preview respects the server's own ordering and limits; nothing is
 * re-sorted or re-ranked on the client.
 */
export const SocialHomeScreen: React.FC<SocialHomeScreenProps> = ({ client }) => {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  // These are previews, so they deliberately use their own query keys. Reusing
  // the full-screen keys would write a single partial page into the cache of an
  // infinite query and break pagination on the list screens.
  const [eventsQuery, communitiesQuery, discoverQuery, feedQuery] = useQueries({
    queries: [
      {
        queryKey: SOCIAL_QUERY_KEYS.homePreview.events,
        queryFn: () => client.discoverEvents({ limit: PREVIEW_LIMIT }),
      },
      {
        queryKey: SOCIAL_QUERY_KEYS.homePreview.myCommunities,
        queryFn: () => client.getUserCommunities({ limit: PREVIEW_LIMIT }),
      },
      {
        queryKey: SOCIAL_QUERY_KEYS.homePreview.discoverCommunities,
        queryFn: () => client.discoverCommunities({ limit: PREVIEW_LIMIT }),
      },
      {
        queryKey: SOCIAL_QUERY_KEYS.homePreview.feed,
        queryFn: () => client.getFeed({ limit: PREVIEW_LIMIT }),
      },
    ],
  });

  useEffect(() => {
    trackOnboardingEvent('social_home_opened', {});
  }, []);

  const myCommunities = (communitiesQuery.data?.items ?? []) as CommunityDto[];
  const suggestedCommunities = (discoverQuery.data?.items ?? []) as CommunityDto[];
  const events = (eventsQuery.data?.items ?? []) as EventDto[];
  const posts = (feedQuery.data?.items ?? []) as PostDto[];

  // Each section resolves its own state. A single failing request must not blank
  // the whole page, and a failure must never be rendered as an empty section.
  const sectionState = (query: {
    data: { readonly items: readonly unknown[] } | undefined;
    isLoading: boolean;
    isError: boolean;
  }) => {
    if (query.isLoading) return 'loading' as const;
    if (query.isError) return 'error' as const;
    return 'ready' as const;
  };

  const eventsState = sectionState(eventsQuery);
  const myCommunitiesState = sectionState(communitiesQuery);
  const discoverState = sectionState(discoverQuery);
  const feedState = sectionState(feedQuery);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xl, maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
      ]}
      showsVerticalScrollIndicator={false}
      testID="social-home"
    >
      <View style={styles.header}>
        <View style={styles.flexOne}>
          <Heading level="h1">Explore</Heading>
          <Text variant="bodySmall" color="secondary">
            Communities, events and conversations on Nazar.
          </Text>
        </View>
        <Button
          label="Post"
          icon="edit"
          size="sm"
          onPress={() => {
            haptics.selection();
            router.push(socialRoutes.createPost());
          }}
          accessibilityLabel="Create a post"
          testID="social-home-create-post"
        />
      </View>

      <Section
        title="Upcoming events"
        actionLabel="See all"
        onAction={() => router.push(socialRoutes.events())}
        testID="social-home-events"
      >
        {eventsState === 'loading' ? (
          <PreviewSkeleton />
        ) : eventsState === 'error' ? (
          <ErrorRow
            error={eventsQuery.error}
            onRetry={() => void eventsQuery.refetch()}
            testID="social-home-events-error"
          />
        ) : events.length === 0 ? (
          <EmptyRow
            message="No events have been published yet."
            actionLabel="Browse events"
            onAction={() => router.push(socialRoutes.events())}
          />
        ) : (
          events.map((event) => (
            <View key={event.id} style={{ marginBottom: spacing.md }}>
              <EventCard
                id={event.id}
                title={event.title}
                dateFormatted={formatEventDateLabel(event.startAt)}
                location={event.type === 'ONLINE' ? 'Online' : event.locationName}
                attendeeCount={event.attendeeCount}
                rsvpStatus={toEventCardRsvp(event.currentUserRsvp)}
                onPress={() => router.push(socialRoutes.event(event.id))}
                testID={`social-home-event-${event.id}`}
              />
              <Text
                variant="caption"
                color="tertiary"
                style={styles.srOnlyHelper}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {describeEventForScreenReader(event)}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section
        title="Your communities"
        actionLabel={myCommunities.length > 0 ? 'See all' : undefined}
        onAction={() => router.push(socialRoutes.communities())}
        testID="social-home-my-communities"
      >
        {myCommunitiesState === 'loading' ? (
          <PreviewSkeleton />
        ) : myCommunitiesState === 'error' ? (
          <ErrorRow
            error={communitiesQuery.error}
            onRetry={() => void communitiesQuery.refetch()}
            testID="social-home-communities-error"
          />
        ) : myCommunities.length === 0 ? (
          <EmptyRow
            message="You have not joined any communities yet."
            actionLabel="Find communities"
            onAction={() => router.push(socialRoutes.communities())}
          />
        ) : (
          myCommunities.map((community) => (
            <View key={community.id} style={{ marginBottom: spacing.sm }}>
              <CommunityCard
                id={community.id}
                name={community.name}
                description={community.description}
                memberCount={community.memberCount}
                isJoined
                onPress={() => router.push(socialRoutes.community(community.id))}
                testID={`social-home-community-${community.id}`}
              />
              <Text
                variant="caption"
                color="tertiary"
                style={styles.srOnlyHelper}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {describeCommunityForScreenReader(community)}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section
        title="Communities to explore"
        actionLabel="See all"
        onAction={() => router.push(socialRoutes.communities())}
        testID="social-home-discover"
      >
        {discoverState === 'loading' ? (
          <PreviewSkeleton />
        ) : discoverState === 'error' ? (
          <ErrorRow
            error={discoverQuery.error}
            onRetry={() => void discoverQuery.refetch()}
            testID="social-home-discover-error"
          />
        ) : suggestedCommunities.length === 0 ? (
          <EmptyRow message="No communities to suggest right now." />
        ) : (
          suggestedCommunities.map((community) => (
            <View key={community.id} style={{ marginBottom: spacing.sm }}>
              <CommunityCard
                id={community.id}
                name={community.name}
                description={community.description}
                memberCount={community.memberCount}
                onPress={() => router.push(socialRoutes.community(community.id))}
                testID={`social-home-discover-${community.id}`}
              />
            </View>
          ))
        )}
      </Section>

      <Section
        title="Latest posts"
        actionLabel="See all"
        onAction={() => router.push(socialRoutes.feed())}
        testID="social-home-posts"
      >
        {feedState === 'loading' ? (
          <PreviewSkeleton />
        ) : feedState === 'error' ? (
          <ErrorRow
            error={feedQuery.error}
            onRetry={() => void feedQuery.refetch()}
            testID="social-home-posts-error"
          />
        ) : posts.length === 0 ? (
          <EmptyRow
            message="No posts yet."
            actionLabel="Write the first one"
            onAction={() => router.push(socialRoutes.createPost())}
          />
        ) : (
          posts.map((post) => (
            <View key={post.id} style={{ marginBottom: spacing.md }}>
              <PostCard
                id={post.id}
                authorName={post.author?.displayName ?? 'Nazar member'}
                authorPhoto={post.author?.avatarUrl ?? null}
                authorBadge={post.communityName ?? undefined}
                content={post.content}
                mediaUrl={post.mediaUrls?.[0] ?? null}
                timestamp={formatRelativeTime(post.createdAt)}
                likesCount={post.likeCount}
                commentsCount={post.commentCount}
                isLiked={post.userReaction === 'LIKE'}
                onLike={() => router.push(socialRoutes.post(post.id))}
                onCommentPress={() => router.push(socialRoutes.post(post.id))}
                onPress={() => router.push(socialRoutes.post(post.id))}
              />
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
};

interface SectionProps {
  readonly title: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly children: React.ReactNode;
  readonly testID?: string;
}

const Section: React.FC<SectionProps> = ({ title, actionLabel, onAction, children, testID }) => {
  const { spacing } = useTheme();
  return (
    <View style={[styles.section, { marginTop: spacing.lg }]} testID={testID}>
      <View style={styles.sectionHeader}>
        <Heading level="h3">{title}</Heading>
        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title.toLowerCase()}`}
            testID={`${testID}-see-all`}
          >
            <Text variant="caption" weight="semibold" color="accent">
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
};

const PreviewSkeleton: React.FC = () => (
  <View style={{ gap: 8 }}>
    <SkeletonBox width="100%" height={88} radius="radiusLG" />
    <SkeletonBox width="100%" height={88} radius="radiusLG" />
  </View>
);

interface EmptyRowProps {
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

const EmptyRow: React.FC<EmptyRowProps> = ({ message, actionLabel, onAction }) => {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.emptyRow,
        { borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
      ]}
      accessibilityRole="summary"
    >
      <Text variant="bodySmall" color="secondary">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="tertiary"
          size="sm"
          style={{ marginTop: spacing.sm }}
          rightIcon="chevron"
        />
      ) : null}
    </View>
  );
};

interface ErrorRowProps {
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly testID?: string;
}

/**
 * A failed preview is shown as a failure, not as "nothing here". Telling someone
 * there are no events when the request actually failed is the kind of small lie
 * that makes a working feature look broken.
 */
const ErrorRow: React.FC<ErrorRowProps> = ({ error, onRetry, testID }) => {
  const { colors, spacing } = useTheme();
  const view = describeSocialError(error);
  return (
    <View
      style={[
        styles.emptyRow,
        { borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <View style={styles.errorRowHeader}>
        <Icon name="alertCircle" size="sm" color={colors.error} />
        <Text variant="bodySmall" color="secondary" style={{ marginLeft: 6, flex: 1 }}>
          {view.message}
        </Text>
      </View>
      <Button
        label="Try again"
        onPress={onRetry}
        variant="tertiary"
        size="sm"
        style={{ marginTop: spacing.sm }}
        accessibilityLabel="Retry loading this section"
        testID={`${testID}-retry`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  errorRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyRow: {
    borderWidth: 1,
    borderRadius: 12,
  },
  // The card's own label already covers screen readers; this text exists only
  // to carry the richer description to assistive tech without duplicating it
  // visually.
  srOnlyHelper: {
    height: 0,
    opacity: 0,
  },
});
