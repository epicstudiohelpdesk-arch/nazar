import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { EventDto, EventType } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { EventCard } from '../design/components/card/EventCard.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { Button } from '../design/components/button/Button.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { SocialLoadMoreButton } from './components/SocialPostList.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import {
  byId,
  describeSocialError,
  flattenPages,
  formatEventDateLabel,
  getNextCursorPageParam,
  socialRoutes,
  toEventCardRsvp,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';

export interface EventsScreenProps {
  readonly client: SocialApiClient;
  /** Locks the list to one community when reached from a community detail. */
  readonly communityId?: string;
  readonly onBack?: () => void;
}

type EventFilter = 'ALL' | EventType;

const PAGE_SIZE = 20;

const FILTERS: readonly { key: EventFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ONLINE', label: 'Online' },
  { key: 'PHYSICAL', label: 'In person' },
];

/**
 * Event discovery.
 *
 * The `type` filter is a server query parameter, not a client-side filter, so
 * the list never shows a partial page that would look like a complete result.
 * `GET /v1/events` returns only `PUBLISHED` events, ordered by `startAt ASC`.
 */
export const EventsScreen: React.FC<EventsScreenProps> = ({ client, communityId, onBack }) => {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const [filter, setFilter] = useState<EventFilter>('ALL');

  const query = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.events({
      communityId,
      type: filter === 'ALL' ? undefined : filter,
    }),
    queryFn: ({ pageParam }) =>
      client.discoverEvents({
        limit: PAGE_SIZE,
        cursor: pageParam,
        communityId,
        type: filter === 'ALL' ? undefined : filter,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
  });

  const events = flattenPages(query.data?.pages, byId) as EventDto[];

  if (query.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Events" onBack={onBack} />
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} width="100%" height={96} radius="radiusLG" />
          ))}
        </View>
      </View>
    );
  }

  if (query.isError) {
    const view = describeSocialError(query.error);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Events" onBack={onBack} />
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={view.isRetryable ? () => void query.refetch() : undefined}
          testID="events-error"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title="Events"
        onBack={onBack}
        rightAction={
          <Button
            label="Host"
            icon="plus"
            size="sm"
            variant="tertiary"
            onPress={() => {
              haptics.selection();
              router.push(socialRoutes.createEvent(communityId));
            }}
            accessibilityLabel="Host an event"
            testID="events-create-btn"
          />
        }
      />

      {!communityId ? (
        <View
          style={[styles.filterBar, { borderBottomColor: colors.border }]}
          accessibilityRole="tablist"
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f.key ? colors.accentSoft : 'transparent',
                  borderColor: filter === f.key ? colors.accent : colors.border,
                  borderRadius: 999,
                  paddingHorizontal: spacing.md,
                },
              ]}
              onPress={() => {
                haptics.selection();
                setFilter(f.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f.key }}
              accessibilityLabel={f.label}
              testID={`events-filter-${f.key.toLowerCase()}`}
            >
              <Text
                variant="caption"
                weight="semibold"
                color={filter === f.key ? 'accent' : 'secondary'}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <EventCard
              id={item.id}
              title={item.title}
              dateFormatted={formatEventDateLabel(item.startAt)}
              location={item.type === 'ONLINE' ? 'Online' : item.locationName}
              attendeeCount={item.attendeeCount}
              rsvpStatus={toEventCardRsvp(item.currentUserRsvp)}
              onPress={() => {
                haptics.selection();
                trackOnboardingEvent('event_viewed', { event_id: item.id, event_type: item.type });
                router.push(socialRoutes.event(item.id));
              }}
            />
          </View>
        )}
        contentContainerStyle={[
          events.length === 0 ? styles.emptyContent : styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListEmptyComponent={
          <EmptyState
            type="noEvents"
            title={filter === 'ALL' ? 'No upcoming events' : 'No matching events'}
            description={
              filter === 'ALL'
                ? 'Published events will appear here as soon as organisers schedule them.'
                : 'Try a different filter to see more events.'
            }
            testID="events-empty"
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <SocialLoadMoreButton
              hasMore={query.hasNextPage}
              isFetching={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
            {events.length > 0 ? (
              <View style={[styles.legend, { marginTop: spacing.sm }]}>
                <Icon name="info" size="tiny" color={colors.textTertiary} />
                <Text variant="caption" color="tertiary" style={{ marginLeft: 6 }}>
                  Sorted by start time. Draft and cancelled events are not listed.
                </Text>
              </View>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={9}
        removeClippedSubviews
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
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  filterChip: {
    borderWidth: 1,
    paddingVertical: 6,
  },
  content: {
    padding: 16,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  footer: {
    paddingVertical: 16,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
