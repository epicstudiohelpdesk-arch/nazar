import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { EventDto, EventType } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon, type IconName } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { DateSelector } from '../design/components/input/DateSelector.js';
import { type SocialApiClient } from './social-api.js';
import { invalidateEventLists } from './social-cache.js';
import {
  classifySocialError,
  getMutationErrorMessage,
  getSocialFieldErrors,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CreateEventScreenProps {
  readonly client: SocialApiClient;
  /** Set when hosting on behalf of a community. */
  readonly communityId?: string;
  readonly communityName?: string;
  readonly onCreated?: (event: EventDto) => void;
  readonly onCancel?: () => void;
}

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 3000;
const LOCATION_NAME_MAX = 255;
const LOCATION_FIELD_MAX = 500;
const CAPACITY_MAX = 10000;

const TYPE_OPTIONS: readonly {
  key: EventType;
  label: string;
  hint: string;
  icon: IconName;
}[] = [
  {
    key: 'ONLINE',
    label: 'Online',
    hint: 'Guests get the joining link once their RSVP is confirmed.',
    icon: 'compass',
  },
  {
    key: 'PHYSICAL',
    label: 'In person',
    hint: 'The address is only shared with confirmed attendees.',
    icon: 'location',
  },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Builds an ISO 8601 instant from a `Date` and an `HH:MM` 24-hour string.
 * Returns null when the time is malformed, so no invalid date is ever submitted.
 */
function toIsoInstant(date: Date, time: string): string | null {
  if (!TIME_PATTERN.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const instant = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return instant.toISOString();
}

/**
 * Event creation form.
 *
 * The API owns capacity and waitlist behaviour, so the waitlist toggle here only
 * states intent: the server decides who is confirmed and who is waitlisted.
 * Coordinates are not collected because the mobile app has no location picker,
 * and the address is the field the venue is identified by.
 */
export const CreateEventScreen: React.FC<CreateEventScreenProps> = ({
  client,
  communityId,
  communityName,
  onCreated,
  onCancel,
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('PHYSICAL');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [capacityInput, setCapacityInput] = useState('');
  const [isWaitlistEnabled, setIsWaitlistEnabled] = useState(true);

  const startAt = startDate ? toIsoInstant(startDate, startTime) : null;
  const endAt = endDate ? toIsoInstant(endDate, endTime) : null;

  const isTimeInvalid = (value: string) => value.length > 0 && !TIME_PATTERN.test(value);
  const isEndBeforeStart =
    startAt !== null && endAt !== null ? new Date(endAt) <= new Date(startAt) : false;
  const capacityValue = capacityInput.trim() === '' ? null : Number(capacityInput);
  const isCapacityInvalid =
    capacityValue !== null &&
    (!Number.isInteger(capacityValue) || capacityValue < 1 || capacityValue > CAPACITY_MAX);

  const createMutation = useMutation({
    mutationFn: () => {
      if (startAt === null || endAt === null) {
        throw new Error('A start and end time are required.');
      }
      trackOnboardingEvent('event_creation_attempted', {
        type,
        has_community: Boolean(communityId),
      });
      return client.createEvent({
        title: title.trim(),
        description: description.trim(),
        communityId: communityId ?? null,
        type,
        startAt,
        endAt,
        locationName: locationName.trim(),
        locationAddress: type === 'PHYSICAL' ? locationAddress.trim() || null : null,
        locationUrl: type === 'ONLINE' ? locationUrl.trim() || null : null,
        capacity: capacityValue,
        isWaitlistEnabled,
      });
    },
    onSuccess: (event) => {
      invalidateEventLists(queryClient, event.id);
      trackOnboardingEvent('event_created', {
        event_id: event.id,
        event_type: event.type,
        has_community: Boolean(communityId),
      });
      onCreated?.(event);
    },
  });

  const fieldErrors = getSocialFieldErrors(createMutation.error);

  const canSubmit =
    title.trim().length >= 2 &&
    description.trim().length >= 2 &&
    locationName.trim().length >= 1 &&
    startAt !== null &&
    endAt !== null &&
    !isEndBeforeStart &&
    !isCapacityInvalid &&
    !createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="create-event-screen"
    >
      <TopNavHeader
        title="New event"
        onBack={onCancel}
        rightAction={
          <Button
            label={createMutation.isPending ? 'Creating' : 'Create'}
            size="sm"
            disabled={!canSubmit}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            accessibilityHint="Publishes this event and lists it for discovery"
            testID="create-event-submit"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: fieldErrors.title ? colors.error : colors.border,
              borderRadius: radii.radiusMD,
              color: colors.textPrimary,
              padding: spacing.md,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor={colors.textTertiary}
          maxLength={TITLE_MAX}
          accessibilityLabel="Event title"
          testID="create-event-title"
        />
        {fieldErrors.title ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.title.message}
          </Text>
        ) : null}

        <TextInput
          style={[
            styles.input,
            styles.multiline,
            {
              backgroundColor: colors.surface,
              borderColor: fieldErrors.description ? colors.error : colors.border,
              borderRadius: radii.radiusMD,
              color: colors.textPrimary,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is happening?"
          placeholderTextColor={colors.textTertiary}
          maxLength={DESCRIPTION_MAX}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Event description"
          testID="create-event-description"
        />
        {fieldErrors.description ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.description.message}
          </Text>
        ) : null}

        <Text variant="caption" color="tertiary" testID="create-event-host-note">
          {communityName
            ? `Hosting for ${communityName}`
            : communityId
              ? 'Hosting for a community'
              : 'Hosting as yourself'}
        </Text>

        <Text variant="caption" weight="semibold" color="secondary" style={styles.sectionLabel}>
          HOW GUESTS ATTEND
        </Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((option) => {
            const isSelected = type === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.typeOption,
                  {
                    borderColor: isSelected ? colors.accent : colors.border,
                    backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                    borderRadius: radii.radiusMD,
                    padding: spacing.md,
                  },
                ]}
                onPress={() => setType(option.key)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                accessibilityHint={option.hint}
                testID={`create-event-type-${option.key.toLowerCase()}`}
              >
                <View style={styles.typeOptionHeader}>
                  <Icon
                    name={option.icon}
                    size="sm"
                    color={isSelected ? colors.accentStrong : colors.textSecondary}
                  />
                  <Text
                    variant="bodySmall"
                    weight="semibold"
                    color={isSelected ? 'accent' : 'primary'}
                    style={{ marginLeft: 6, flex: 1 }}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? <Icon name="checkCircle" size="sm" color={colors.accent} /> : null}
                </View>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {option.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text variant="caption" weight="semibold" color="secondary" style={styles.sectionLabel}>
          WHEN
        </Text>
        <DateSelector
          label="Starts on"
          value={startDate}
          onChangeDate={setStartDate}
          testID="create-event-start-date"
        />
        <TimeField
          label="Start time"
          value={startTime}
          onChangeText={setStartTime}
          error={isTimeInvalid(startTime) ? 'Use 24-hour time, for example 19:30.' : undefined}
          testID="create-event-start-time"
        />

        <DateSelector
          label="Ends on"
          value={endDate}
          onChangeDate={setEndDate}
          error={fieldErrors.endAt?.message}
          testID="create-event-end-date"
          style={styles.spacedTop}
        />
        <TimeField
          label="End time"
          value={endTime}
          onChangeText={setEndTime}
          error={
            isTimeInvalid(endTime)
              ? 'Use 24-hour time, for example 21:00.'
              : isEndBeforeStart
                ? 'The end time must be after the start time.'
                : undefined
          }
          testID="create-event-end-time"
        />

        <Text variant="caption" weight="semibold" color="secondary" style={styles.sectionLabel}>
          WHERE
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: fieldErrors.locationName ? colors.error : colors.border,
              borderRadius: radii.radiusMD,
              color: colors.textPrimary,
              padding: spacing.md,
            },
          ]}
          value={locationName}
          onChangeText={setLocationName}
          placeholder={type === 'ONLINE' ? 'Platform, e.g. Zoom' : 'Venue name'}
          placeholderTextColor={colors.textTertiary}
          maxLength={LOCATION_NAME_MAX}
          accessibilityLabel="Location name"
          testID="create-event-location-name"
        />
        {fieldErrors.locationName ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.locationName.message}
          </Text>
        ) : null}

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor:
                fieldErrors.locationUrl || fieldErrors.locationAddress
                  ? colors.error
                  : colors.border,
              borderRadius: radii.radiusMD,
              color: colors.textPrimary,
              padding: spacing.md,
              marginTop: spacing.sm,
            },
          ]}
          value={type === 'ONLINE' ? locationUrl : locationAddress}
          onChangeText={type === 'ONLINE' ? setLocationUrl : setLocationAddress}
          placeholder={type === 'ONLINE' ? 'Joining link' : 'Street address'}
          placeholderTextColor={colors.textTertiary}
          maxLength={LOCATION_FIELD_MAX}
          autoCapitalize="none"
          keyboardType={type === 'ONLINE' ? 'url' : 'default'}
          accessibilityLabel={type === 'ONLINE' ? 'Joining link' : 'Street address'}
          testID="create-event-location-detail"
        />
        {fieldErrors.locationUrl || fieldErrors.locationAddress ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
            {(fieldErrors.locationUrl ?? fieldErrors.locationAddress)?.message}
          </Text>
        ) : null}
        <Text variant="caption" color="tertiary" style={styles.fieldError}>
          {type === 'ONLINE'
            ? 'Only guests with a confirmed RSVP can see this link.'
            : 'Only guests with a confirmed RSVP can see this address.'}
        </Text>

        <Text variant="caption" weight="semibold" color="secondary" style={styles.sectionLabel}>
          CAPACITY
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: isCapacityInvalid || fieldErrors.capacity ? colors.error : colors.border,
              borderRadius: radii.radiusMD,
              color: colors.textPrimary,
              padding: spacing.md,
            },
          ]}
          value={capacityInput}
          onChangeText={setCapacityInput}
          placeholder="Unlimited"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          accessibilityLabel="Event capacity"
          accessibilityHint="Leave empty for no limit"
          testID="create-event-capacity"
        />
        {isCapacityInvalid || fieldErrors.capacity ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.capacity?.message ??
              `Enter a whole number between 1 and ${CAPACITY_MAX}, or leave it empty.`}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.waitlistRow, { borderColor: colors.border }]}
          onPress={() => setIsWaitlistEnabled((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="switch"
          accessibilityState={{ checked: isWaitlistEnabled }}
          accessibilityLabel="Enable a waitlist"
          accessibilityHint="When the event is full, new RSVPs join a waitlist"
          testID="create-event-waitlist-toggle"
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="semibold">
              Waitlist
            </Text>
            <Text variant="caption" color="secondary">
              {isWaitlistEnabled
                ? 'Guests are waitlisted when the event is full.'
                : 'New RSVPs will be rejected once the event is full.'}
            </Text>
          </View>
          <Icon
            name={isWaitlistEnabled ? 'checkCircle' : 'eyeOff'}
            size="md"
            color={isWaitlistEnabled ? colors.accent : colors.textTertiary}
          />
        </TouchableOpacity>

        {createMutation.isError ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.errorSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.md,
                marginTop: spacing.md,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="create-event-error"
          >
            <View style={styles.errorRow}>
              <Icon name="alertCircle" size="sm" color={colors.error} />
              <Text variant="caption" color="error" style={{ marginLeft: 6, flex: 1 }}>
                {getMutationErrorMessage(createMutation.error)}
              </Text>
            </View>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={() => createMutation.mutate()}
              accessibilityHint="Submits the event again"
              testID="create-event-retry"
            />
            {/* Event hosting has no premium gate today. Offering a plan after a
                network or validation failure would blame the user's account for
                a problem it did not cause, so this only appears if the API
                actually answers with an entitlement error. */}
            {classifySocialError(createMutation.error) === 'entitlement_required' ? (
              <Button
                label="See plans"
                variant="tertiary"
                size="sm"
                style={{ marginTop: spacing.sm }}
                onPress={() => router.push('/billing')}
                accessibilityHint="Opens plans and billing"
                testID="create-event-upgrade"
              />
            ) : null}
          </View>
        ) : null}

        <Button
          label="Cancel"
          variant="tertiary"
          size="sm"
          fullWidth
          style={{ marginTop: spacing.lg }}
          onPress={() => onCancel?.()}
          testID="create-event-cancel"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

interface TimeFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly error?: string;
  readonly testID?: string;
}

const TimeField: React.FC<TimeFieldProps> = ({ label, value, onChangeText, error, testID }) => {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text variant="caption" weight="semibold" color="secondary">
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            borderRadius: radii.radiusMD,
            color: colors.textPrimary,
            padding: spacing.md,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder="19:30"
        placeholderTextColor={colors.textTertiary}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={label}
        accessibilityHint="24-hour time, for example 19:30"
        testID={testID}
      />
      {error ? (
        <Text variant="caption" color="error" accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    fontSize: 15,
    borderWidth: 1,
    minHeight: 48,
  },
  multiline: {
    minHeight: 110,
  },
  fieldError: {
    marginTop: 4,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 6,
  },
  spacedTop: {
    marginTop: 12,
  },
  typeRow: {
    gap: 8,
  },
  typeOption: {
    borderWidth: 1,
  },
  typeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },
  errorBanner: {
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
