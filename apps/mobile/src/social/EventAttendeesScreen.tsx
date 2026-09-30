import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { EventRsvpDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SocialPeopleList, type SocialPerson } from './components/SocialPeopleList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { byId, flattenPages, getNextCursorPageParam } from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface EventAttendeesScreenProps {
  readonly client: SocialApiClient;
  readonly eventId: string;
  readonly onBack?: () => void;
}

const PAGE_SIZE = 20;

/**
 * Full, paginated attendee roster.
 *
 * `GET /v1/events/:id/attendees` only returns `GOING` RSVPs, so this is a
 * confirmed-guest list; the waitlist is visible as a count on the detail screen.
 */
export const EventAttendeesScreen: React.FC<EventAttendeesScreenProps> = ({
  client,
  eventId,
  onBack,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.eventAttendees(eventId),
    queryFn: ({ pageParam }) =>
      client.listEventAttendees(eventId, { limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: Boolean(eventId),
  });

  const attendees = flattenPages(query.data?.pages, byId) as EventRsvpDto[];

  useEffect(() => {
    trackOnboardingEvent('event_attendees_viewed', { eventId });
  }, [eventId]);

  const people: SocialPerson[] = attendees.map((item) => ({
    id: item.id,
    userId: item.userId,
    displayName: item.user?.displayName ?? '',
    avatarUrl: item.user?.avatarUrl ?? null,
    badgeLabel: 'Going',
    badgeVariant: 'success',
    note: item.promotedFromWaitlistAt ? 'Moved up from the waitlist' : null,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader title="Attendees" onBack={onBack} />
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
        emptyTitle="No one has confirmed yet"
        emptyDescription="Confirmed attendees will appear here as people RSVP."
        loadingTestID="attendees-loading"
        listTestID="event-attendees"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
