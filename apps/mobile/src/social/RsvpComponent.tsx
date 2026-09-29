import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import type { EventRsvpStatus } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface RsvpComponentProps {
  readonly client: SocialApiClient;
  readonly eventId: string;
  readonly currentStatus?: EventRsvpStatus | null;
  readonly isFull?: boolean;
  readonly isWaitlistEnabled?: boolean;
  readonly onRsvpChanged?: (status: EventRsvpStatus | null) => void;
}

export function RsvpComponent({
  client,
  eventId,
  currentStatus,
  isFull,
  isWaitlistEnabled,
  onRsvpChanged,
}: RsvpComponentProps) {
  const [status, setStatus] = useState<EventRsvpStatus | null>(currentStatus || null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoing = async () => {
    try {
      setLoading(true);
      const res = await client.rsvpEvent(eventId, { status: 'GOING' });
      setStatus(res.status);
      onRsvpChanged?.(res.status);
    } catch (err: unknown) {
      console.error('RSVP going failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInterested = async () => {
    try {
      setLoading(true);
      const res = await client.rsvpEvent(eventId, { status: 'INTERESTED' });
      setStatus(res.status);
      onRsvpChanged?.(res.status);
    } catch (err: unknown) {
      console.error('RSVP interested failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      await client.cancelRsvp(eventId);
      setStatus(null);
      onRsvpChanged?.(null);
    } catch (err: unknown) {
      console.error('Cancel RSVP failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {status ? (
        <View style={styles.confirmedRow}>
          <Text style={styles.statusLabel}>
            Your status: <Text style={styles.boldStatus}>{status}</Text>
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Change / Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.btn, styles.goingBtn]} onPress={handleGoing}>
            <Text style={styles.btnText}>
              {isFull ? (isWaitlistEnabled ? 'Join Waitlist' : 'Event Full') : 'Going'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.interestedBtn]} onPress={handleInterested}>
            <Text style={styles.interestedBtnText}>Interested</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  loadingBox: {
    padding: 16,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  goingBtn: {
    backgroundColor: '#007AFF',
  },
  interestedBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  interestedBtnText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  boldStatus: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cancelBtnText: {
    color: '#FF3B30',
    fontSize: 13,
  },
});
