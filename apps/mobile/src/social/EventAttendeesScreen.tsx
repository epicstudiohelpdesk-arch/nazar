import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { EventRsvpDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
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
  const { colors, radii, spacing } = useTheme();
  const [plusOnesOnly, setPlusOnesOnly] = useState<boolean>(false);

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.eventAttendees(eventId, plusOnesOnly),
    queryFn: ({ pageParam }) =>
      client.listEventAttendees(eventId, {
        limit: PAGE_SIZE,
        cursor: pageParam,
        plusOnesOnly: plusOnesOnly ? true : undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: Boolean(eventId),
  });

  const attendees = flattenPages(query.data?.pages, byId) as EventRsvpDto[];

  useEffect(() => {
    trackOnboardingEvent('event_attendees_viewed', { eventId, plusOnesOnly });
  }, [eventId, plusOnesOnly]);

  const people: SocialPerson[] = attendees.map((item) => ({
    id: item.id,
    userId: item.userId,
    displayName: item.user?.displayName ?? '',
    avatarUrl: item.user?.avatarUrl ?? null,
    badgeLabel: item.lookingForPlusOne ? '🎟️ Looking for +1' : 'Going',
    badgeVariant: item.lookingForPlusOne ? 'accent' : 'success',
    note: item.plusOneNote || (item.promotedFromWaitlistAt ? 'Moved up from the waitlist' : null),
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader title="Attendees" onBack={onBack} />
      <View style={[styles.filterBar, { borderBottomColor: colors.border, padding: spacing.sm }]}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: !plusOnesOnly ? colors.accentSoft : colors.surface,
              borderColor: !plusOnesOnly ? colors.accent : colors.border,
              borderRadius: radii.radiusFull,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={() => setPlusOnesOnly(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !plusOnesOnly }}
          testID="attendees-filter-all"
        >
          <Text
            variant="caption"
            weight={!plusOnesOnly ? 'bold' : 'medium'}
            color={!plusOnesOnly ? 'accent' : 'secondary'}
          >
            All Attendees
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: plusOnesOnly ? colors.accentSoft : colors.surface,
              borderColor: plusOnesOnly ? colors.accent : colors.border,
              borderRadius: radii.radiusFull,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              marginLeft: spacing.sm,
            },
          ]}
          onPress={() => setPlusOnesOnly(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: plusOnesOnly }}
          testID="attendees-filter-plus-one"
        >
          <Text
            variant="caption"
            weight={plusOnesOnly ? 'bold' : 'medium'}
            color={plusOnesOnly ? 'accent' : 'secondary'}
          >
            🎟️ Looking for +1
          </Text>
        </TouchableOpacity>
      </View>
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
        emptyTitle={plusOnesOnly ? 'No +1 seekers yet' : 'No one has confirmed yet'}
        emptyDescription={
          plusOnesOnly
            ? 'Attendees seeking a +1 will appear here. Be the first to post a +1!'
            : 'Confirmed attendees will appear here as people RSVP.'
        }
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  filterChip: {
    borderWidth: 1,
  },
});
