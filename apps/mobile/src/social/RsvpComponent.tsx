import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { useTheme } from '../design/theme/index.js';
import { SOCIAL_QUERY_KEYS, type SocialApiClient } from './social-api.js';
import { invalidateEventLists } from './social-cache.js';
import { deriveRsvpView, getMutationErrorMessage, type RsvpTarget } from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface RsvpComponentProps {
  readonly client: SocialApiClient;
  readonly eventId: string;
  /**
   * The event shape used to build controls. `status` and `currentUserRsvp` are
   * read from the server response; this component keeps no RSVP state of its own.
   */
  readonly event: { readonly status: string; readonly currentUserRsvp?: string | null };
  /**
   * Applied by the server response before the cache is refetched, so the UI
   * never has to guess. Still refetched afterwards to pick up counter changes
   * such as waitlist promotion.
   */
  readonly onRsvpChanged?: (status: string | null) => void;
  readonly compact?: boolean;
}

/**
 * RSVP control driven entirely by server state.
 *
 * Deliberate non-behaviours:
 * - No local `useState` for the RSVP. The previous implementation held the status
 *   locally, so an out-of-band change (waitlist promotion, organiser action) left
 *   the UI showing a stale answer.
 * - No capacity arithmetic. `attendeeCount >= capacity` is never evaluated here;
 *   the server answers with `GOING`, `WAITLISTED`, or `EVENT_FULL`, and this
 *   component renders whichever it received.
 * - Never optimistically flips the badge. The confirmed status appears only after
 *   the mutation resolves, and a failure reverts to the last server value.
 */
export const RsvpComponent: React.FC<RsvpComponentProps> = ({
  client,
  eventId,
  event,
  onRsvpChanged,
  compact = false,
}) => {
  const { colors, radii, spacing } = useTheme();
  const queryClient = useQueryClient();
  const view = deriveRsvpView(event as Parameters<typeof deriveRsvpView>[0]);

  const mutation = useMutation({
    mutationFn: async (target: RsvpTarget) => {
      if (target === 'cancel') {
        await client.cancelRsvp(eventId);
        return null;
      }
      const res = await client.rsvpEvent(eventId, { status: target });
      return res.status;
    },
    onSuccess: (status) => {
      // The response is the server's own answer, so it is written into the
      // cached event immediately. Without this the control keeps rendering the
      // previous status until the refetch lands. Counters, capacity and location
      // redaction still come from the refetch below.
      queryClient.setQueryData<{ currentUserRsvp?: string | null }>(
        SOCIAL_QUERY_KEYS.event(eventId),
        (previous) => (previous ? { ...previous, currentUserRsvp: status } : previous)
      );
      invalidateEventLists(queryClient, eventId);
      onRsvpChanged?.(status);
    },
    onError: (error) => {
      trackOnboardingEvent('event_rsvp_failed', {
        eventId,
        reason: getMutationErrorMessage(error),
      });
    },
  });

  const handlePress = (target: RsvpTarget) => {
    trackOnboardingEvent('event_rsvp_attempted', {
      eventId,
      targetStatus: target === 'cancel' ? 'CANCEL' : target,
    });
    mutation.mutate(target, {
      onSuccess: (status) => {
        if (status === null) trackOnboardingEvent('event_rsvp_cancelled', { eventId });
        else if (status === 'WAITLISTED') trackOnboardingEvent('event_waitlisted', { eventId });
        else trackOnboardingEvent('event_rsvp_confirmed', { eventId, status });
      },
    });
  };

  if (view.isClosed) {
    return (
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radii.radiusMD,
            padding: spacing.md,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`RSVPs closed. ${view.closedReason ?? ''}`}
        testID="rsvp-closed"
      >
        <View style={styles.row}>
          <Icon name="info" size="sm" color={colors.textSecondary} />
          <View style={styles.rowText}>
            <Text variant="bodySmall" weight="semibold">
              {view.statusLabel}
            </Text>
            <Text variant="caption" color="secondary">
              {view.closedReason}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const isPending = mutation.isPending;
  const errorMessage = mutation.isError ? getMutationErrorMessage(mutation.error) : null;

  return (
    <View style={styles.container} testID="rsvp-component">
      <View
        style={[
          styles.statusRow,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.radiusMD,
            padding: spacing.sm,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Your RSVP: ${view.statusLabel}. ${view.summary}`}
      >
        <View style={styles.row}>
          <Icon
            name={
              view.status === 'GOING'
                ? 'checkCircle'
                : view.status === 'WAITLISTED'
                  ? 'warning'
                  : 'info'
            }
            size="sm"
            color={
              view.status === 'GOING'
                ? colors.success
                : view.status === 'WAITLISTED'
                  ? colors.warning
                  : colors.textSecondary
            }
          />
          <Text variant="bodySmall" weight="semibold" style={styles.rowText}>
            {view.statusLabel}
          </Text>
        </View>
        <Text variant="caption" color="secondary" style={styles.summary}>
          {view.summary}
        </Text>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.errorRow,
            {
              backgroundColor: colors.errorSoft,
              borderRadius: radii.radiusSM,
              padding: spacing.sm,
              marginTop: spacing.sm,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="rsvp-error"
        >
          <Icon name="alertCircle" size="sm" color={colors.error} />
          <Text variant="caption" color="error" style={styles.rowText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={[styles.actions, compact ? undefined : { marginTop: spacing.md }]}>
        {view.actions.map((action, index) => (
          <Button
            key={action.target}
            label={action.label}
            onPress={() => handlePress(action.target)}
            variant={action.isPrimary ? 'primary' : 'tertiary'}
            size={compact ? 'sm' : 'md'}
            loading={isPending && mutation.variables === action.target}
            disabled={isPending}
            accessibilityLabel={action.accessibilityLabel}
            accessibilityHint={action.accessibilityHint}
            style={index === 0 ? undefined : styles.actionSpacing}
            testID={`rsvp-${action.target.toLowerCase()}-btn`}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  panel: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    marginLeft: 6,
    flex: 1,
  },
  summary: {
    marginTop: 2,
  },
  statusRow: {
    marginTop: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionSpacing: {
    marginLeft: 8,
  },
});
