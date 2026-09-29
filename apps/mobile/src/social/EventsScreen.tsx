import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import type { EventDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface EventsScreenProps {
  readonly client: SocialApiClient;
  readonly onSelectEvent?: (eventId: string) => void;
  readonly onCreateEvent?: () => void;
}

export function EventsScreen({ client, onSelectEvent, onCreateEvent }: EventsScreenProps) {
  const [events, setEvents] = useState<EventDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadEvents = useCallback(
    async (refresh: boolean = false) => {
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        const cursor = refresh ? undefined : nextCursor || undefined;
        const res = await client.discoverEvents({ limit: 20, cursor });

        if (refresh) {
          setEvents([...res.items]);
        } else {
          setEvents((prev) => [...prev, ...res.items]);
        }

        setNextCursor(res.nextCursor || null);
        setHasMore(res.hasMore);
      } catch (err: unknown) {
        console.error('Failed to load events:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client, nextCursor]
  );

  useEffect(() => {
    loadEvents(true);
  }, [client]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const renderEventCard = ({ item }: { item: EventDto }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelectEvent?.(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeText}>{formatDate(item.startAt)}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.location}>
        📍 {item.locationName} · {item.type}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.attendees}>
          👥 {item.attendeeCount} going
          {item.capacity ? ` / ${item.capacity} max` : ''}
        </Text>
        {item.currentUserRsvp ? <Text style={styles.rsvpBadge}>{item.currentUserRsvp}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        {onCreateEvent ? (
          <TouchableOpacity style={styles.createBtn} onPress={onCreateEvent}>
            <Text style={styles.createBtnText}>+ Event</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading && events.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadEvents(true)}
              tintColor="#007AFF"
            />
          }
          onEndReached={() => {
            if (hasMore && !isLoading && !isRefreshing) {
              loadEvents(false);
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No upcoming events discovered.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  createBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  dateBadge: {
    marginBottom: 6,
  },
  dateBadgeText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  attendees: {
    fontSize: 13,
    color: '#3A3A3C',
  },
  rsvpBadge: {
    backgroundColor: '#E5F1FF',
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
  },
});
