import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { EventDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';
import { RsvpComponent } from './RsvpComponent.js';

export interface EventDetailScreenProps {
  readonly client: SocialApiClient;
  readonly eventId: string;
  readonly onBack?: () => void;
}

export function EventDetailScreen({ client, eventId, onBack }: EventDetailScreenProps) {
  const [event, setEvent] = useState<EventDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadEvent = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await client.getEvent(eventId);
      setEvent(data);
    } catch (err: unknown) {
      console.error('Failed to load event:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  if (isLoading || !event) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isFull =
    event.capacity !== null &&
    event.capacity !== undefined &&
    event.attendeeCount >= event.capacity;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.organizer}>
          Hosted by {event.organizer?.displayName || 'Organizer'}
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Time</Text>
          <Text style={styles.infoValue}>
            {new Date(event.startAt).toLocaleString()} -{' '}
            {new Date(event.endAt).toLocaleTimeString()}
          </Text>

          <Text style={styles.infoLabel}>Location ({event.type})</Text>
          <Text style={styles.infoValue}>{event.locationName}</Text>
          {event.locationAddress ? (
            <Text style={styles.privateLocationText}>📌 {event.locationAddress}</Text>
          ) : (
            <Text style={styles.locationHiddenText}>
              Exact address available to confirmed attendees
            </Text>
          )}
          {event.locationUrl ? (
            <Text style={styles.privateLocationText}>🔗 {event.locationUrl}</Text>
          ) : null}

          <Text style={styles.infoLabel}>Capacity</Text>
          <Text style={styles.infoValue}>
            {event.attendeeCount} going
            {event.capacity ? ` / ${event.capacity} total` : ' (Unlimited)'}
            {event.waitlistCount > 0 ? ` · ${event.waitlistCount} waitlisted` : ''}
          </Text>
        </View>

        <RsvpComponent
          client={client}
          eventId={event.id}
          currentStatus={event.currentUserRsvp}
          isFull={isFull}
          isWaitlistEnabled={event.isWaitlistEnabled}
          onRsvpChanged={() => loadEvent()}
        />

        <Text style={styles.sectionTitle}>About this Event</Text>
        <Text style={styles.description}>{event.description}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  organizer: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  privateLocationText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  locationHiddenText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#3A3A3C',
    lineHeight: 22,
  },
});
