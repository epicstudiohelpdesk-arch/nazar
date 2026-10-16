import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/theme/index.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { Button } from '../../design/components/button/Button.js';
import { haptics } from '../../design/haptics/index.js';
import { getDefaultSafetyApi, SAFETY_QUERY_KEYS, invalidateSafetyCaches } from '../safety-api.js';

export interface DateSafetyModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly defaultMatchId?: string;
}

export const DateSafetyModal: React.FC<DateSafetyModalProps> = ({
  visible,
  onClose,
  defaultMatchId,
}) => {
  const { colors, spacing, radii } = useTheme();
  const queryClient = useQueryClient();
  const safetyApi = getDefaultSafetyApi();

  const matchId = defaultMatchId || '01918a24-7411-789a-bcde-0123456789ab';
  const [meetingLocation, setMeetingLocation] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [hoursFromNow, setHoursFromNow] = useState('2');

  const activeCheckinQuery = useQuery({
    queryKey: SAFETY_QUERY_KEYS.activeDateCheckin,
    queryFn: () => safetyApi.getActiveDateCheckin(),
    enabled: visible,
  });

  const createCheckinMutation = useMutation({
    mutationFn: () => {
      const now = Date.now();
      const meetHours = Math.max(1, parseInt(hoursFromNow, 10) || 2);
      const meetingAt = new Date(now + meetHours * 3600 * 1000).toISOString();
      const checkInDeadline = new Date(now + (meetHours + 2) * 3600 * 1000).toISOString();

      return safetyApi.createDateCheckin({
        matchId: matchId.trim(),
        meetingLocation: meetingLocation.trim(),
        meetingAt,
        checkInDeadline,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.activeDateCheckin });
      haptics.notificationSuccess();
      Alert.alert('Date Safety Scheduled', 'Your safety check-in timer has been registered.');
      setMeetingLocation('');
      setEmergencyContactName('');
      setEmergencyContactPhone('');
    },
    onError: (err: unknown) => {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Failed to schedule date check-in';
      Alert.alert('Error', msg);
    },
  });

  const confirmSafeMutation = useMutation({
    mutationFn: (id: string) => safetyApi.confirmDateCheckin(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.activeDateCheckin });
      invalidateSafetyCaches(queryClient);
      haptics.notificationSuccess();
      Alert.alert('Safe & Sound', data.message);
    },
    onError: (err: unknown) => {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Failed to confirm check-in';
      Alert.alert('Error', msg);
    },
  });

  const sosMutation = useMutation({
    mutationFn: (checkinId?: string) =>
      safetyApi.triggerSos({
        dateCheckinId: checkinId ?? null,
        note: 'Emergency SOS triggered from Date Safety modal',
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.activeDateCheckin });
      haptics.notificationError();
      Alert.alert('Emergency SOS Dispatched', data.message, [{ text: 'OK', style: 'destructive' }]);
    },
    onError: (err: unknown) => {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Failed to trigger SOS';
      Alert.alert('SOS Error', msg);
    },
  });

  const handleTriggerSos = (checkinId?: string) => {
    haptics.notificationWarning();
    Alert.alert(
      'Confirm Emergency SOS',
      'Are you sure you want to trigger an Emergency SOS? This will immediately alert your designated emergency contacts and our Trust & Safety monitoring team.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'TRIGGER SOS',
          style: 'destructive',
          onPress: () => sosMutation.mutate(checkinId),
        },
      ]
    );
  };

  const active = activeCheckinQuery.data;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.background, borderRadius: radii.xl },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Icon name="shield" size={24} color={colors.accent} />
              <Heading level="h3" style={{ marginLeft: spacing.sm }}>
                Date Safety & SOS
              </Heading>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Active Check-in banner if present */}
            {activeCheckinQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
            ) : active && active.status === 'SCHEDULED' ? (
              <SurfaceCard style={[styles.activeCard, { borderColor: colors.accentSoft }]}>
                <View style={styles.badgeRow}>
                  <View style={[styles.activeBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text variant="caption" style={{ color: colors.accent, fontWeight: '700' }}>
                      ACTIVE DATE SCHEDULED
                    </Text>
                  </View>
                </View>

                <Heading level="title" style={{ marginTop: spacing.xs }}>
                  📍 {active.meetingLocation}
                </Heading>

                <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
                  Check-in deadline:{' '}
                  {new Date(active.checkInDeadline).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text variant="caption" style={{ color: colors.textSecondary }}>
                  Emergency Contact: {active.emergencyContactName} ({active.emergencyContactPhone})
                </Text>

                <View style={styles.actionRow}>
                  <Button
                    label="I'm Safe (Check In)"
                    variant="primary"
                    onPress={() => confirmSafeMutation.mutate(active.id)}
                    loading={confirmSafeMutation.isPending}
                    style={styles.safeBtn}
                  />
                  <Button
                    label="SOS"
                    variant="destructive"
                    onPress={() => handleTriggerSos(active.id)}
                    loading={sosMutation.isPending}
                    style={styles.sosBtn}
                  />
                </View>
              </SurfaceCard>
            ) : (
              <SurfaceCard style={styles.infoCard}>
                <Text variant="caption" style={{ color: colors.textSecondary, lineHeight: 18 }}>
                  Going out on a date? Set your destination and trusted contact. If you don't check
                  in by your deadline, we will alert your emergency contact.
                </Text>
              </SurfaceCard>
            )}

            {/* Schedule New Check-in Form */}
            {(!active || active.status !== 'SCHEDULED') && (
              <View style={[styles.formContainer, { marginTop: spacing.md }]}>
                <Heading level="title" style={{ marginBottom: spacing.sm }}>
                  Schedule Date Check-In
                </Heading>

                <Text variant="caption" style={{ color: colors.textSecondary, marginBottom: 4 }}>
                  Meeting Location
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="e.g. Joe's Coffee, 14th St"
                  placeholderTextColor={colors.textTertiary}
                  value={meetingLocation}
                  onChangeText={setMeetingLocation}
                />

                <Text
                  variant="caption"
                  style={{ color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm }}
                >
                  Emergency Contact Name
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="e.g. Sarah Jenkins (Friend)"
                  placeholderTextColor={colors.textTertiary}
                  value={emergencyContactName}
                  onChangeText={setEmergencyContactName}
                />

                <Text
                  variant="caption"
                  style={{ color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm }}
                >
                  Emergency Contact Phone Number
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="e.g. +1 555 123 4567"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  value={emergencyContactPhone}
                  onChangeText={setEmergencyContactPhone}
                />

                <Text
                  variant="caption"
                  style={{ color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm }}
                >
                  Date Starts In (Hours)
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="2"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  value={hoursFromNow}
                  onChangeText={setHoursFromNow}
                />

                <Button
                  label="Activate Safety Check-in"
                  variant="primary"
                  onPress={() => createCheckinMutation.mutate()}
                  loading={createCheckinMutation.isPending}
                  disabled={
                    !meetingLocation.trim() ||
                    !emergencyContactName.trim() ||
                    !emergencyContactPhone.trim()
                  }
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}

            {/* Instant Emergency SOS Section */}
            <View style={[styles.sosSection, { borderColor: colors.error, marginTop: spacing.xl }]}>
              <Heading level="title" style={{ color: colors.error }}>
                Instant SOS Panic Button
              </Heading>
              <Text
                variant="caption"
                style={{ color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md }}
              >
                Feel unsafe right now? Tap below to dispatch your live coordinates immediately to
                your emergency contact & safety response team.
              </Text>
              <Button
                label="TRIGGER INSTANT SOS"
                variant="destructive"
                onPress={() => handleTriggerSos()}
                loading={sosMutation.isPending}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentScroll: {
    paddingBottom: 24,
  },
  activeCard: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  safeBtn: {
    flex: 2,
  },
  sosBtn: {
    flex: 1,
  },
  infoCard: {
    padding: 14,
    marginBottom: 12,
  },
  formContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sosSection: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
});
