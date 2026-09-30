import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { EventDto, ReportReasonCode, ReportTargetType } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Heading } from '../design/primitives/Heading.js';
import { Avatar } from '../design/primitives/Avatar.js';
import { Badge } from '../design/primitives/Badge.js';
import { Icon, type IconName } from '../design/primitives/Icon.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { Button } from '../design/components/button/Button.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { ReportModal } from '../safety/components/ReportModal.js';
import { createSafetyApi } from '../safety/safety-api.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { invalidateEventLists } from './social-cache.js';
import { useProfileStore } from '../profile/profile-store.js';
import { RsvpComponent } from './RsvpComponent.js';
import {
  deriveCapacityView,
  deriveLocationView,
  describeEventForScreenReader,
  describeSocialError,
  getMutationErrorMessage,
  formatEventDateRange,
  getEventStatusLabel,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface EventDetailScreenProps {
  readonly client: SocialApiClient;
  readonly eventId: string;
  readonly onBack?: () => void;
}

const ATTENDEE_PREVIEW_LIMIT = 8;

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  client,
  eventId,
  onBack,
}) => {
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentUserId = useProfileStore((state) => state.profile?.userId ?? null);
  const authClient = getDefaultAuthClient();
  const safetyApi = createSafetyApi(authClient);

  const {
    data: event,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EventDto>({
    queryKey: SOCIAL_QUERY_KEYS.event(eventId),
    queryFn: () => client.getEvent(eventId),
    enabled: Boolean(eventId),
  });

  // Only the organiser may cancel, and the API re-checks ownership. A host whose
  // plans change must be able to tell attendees, otherwise the event keeps
  // appearing on their lists as if it were still happening.
  const isOrganizer = Boolean(event && currentUserId && event.organizerId === currentUserId);

  const cancelMutation = useMutation({
    mutationFn: () => client.cancelEvent(eventId),
    onSuccess: () => {
      setCancelError(null);
      trackOnboardingEvent('event_cancelled', { event_id: eventId });
      invalidateEventLists(queryClient, eventId);
    },
    onError: (error) => setCancelError(getMutationErrorMessage(error)),
  });

  // Preview only. The full paginated roster lives on its own route so that a
  // long attendee list cannot be mistaken for a complete one.
  const { data: attendeesData, isLoading: isLoadingAttendees } = useQuery({
    queryKey: SOCIAL_QUERY_KEYS.eventAttendeePreview(eventId),
    queryFn: () => client.listEventAttendees(eventId, { limit: ATTENDEE_PREVIEW_LIMIT }),
    enabled: Boolean(eventId),
  });

  const confirmCancelEvent = () => {
    Alert.alert(
      'Cancel this event?',
      'Attendees will see that the event was cancelled, and nobody can RSVP any more. This cannot be undone.',
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'Cancel event',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  useEffect(() => {
    if (!event) return;
    trackOnboardingEvent('event_viewed', {
      event_id: event.id,
      event_type: event.type,
    });
  }, [event]);

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        title: event.title,
        message: `Join me at ${event.title} on Nazar`,
        url: `https://nazar.app/event/${event.id}`,
      });
    } catch {
      // Native share sheet dismissed.
    }
  };

  const handleReportEvent = async (data: {
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: ReportReasonCode;
    notes?: string;
  }) => {
    await safetyApi.createReport({
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      description: data.notes || null,
    });
    setIsReportModalVisible(false);
    trackOnboardingEvent('social_report_submitted', { targetType: 'EVENT' });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Event" onBack={onBack} />
        <View style={{ padding: spacing.md }}>
          <SkeletonBox width="100%" height={180} radius="radiusMD" />
          <View style={{ height: spacing.md }} />
          <SkeletonBox width="70%" height={28} radius="radiusSM" />
          <View style={{ height: spacing.sm }} />
          <SkeletonBox width="45%" height={18} radius="radiusSM" />
          <View style={{ height: spacing.lg }} />
          <SkeletonBox width="100%" height={100} radius="radiusMD" />
        </View>
      </View>
    );
  }

  if (isError || !event) {
    const view = describeSocialError(error);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Event" onBack={onBack} />
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={view.isRetryable ? () => void refetch() : undefined}
          testID="event-detail-error"
        />
      </View>
    );
  }

  const capacity = deriveCapacityView(event);
  const location = deriveLocationView(event);
  const attendees = attendeesData?.items ?? [];
  const hasMoreAttendees = attendeesData?.hasMore ?? false;
  const isSoldOut = capacity.hasCapacity && capacity.remainingSeats === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessible={false}>
      <TopNavHeader
        title="Event"
        onBack={onBack}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={[styles.headerIconBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Share this event"
              accessibilityHint="Opens the system share sheet"
              testID="event-share-btn"
            >
              <Icon name="share" size="sm" color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsReportModalVisible(true)}
              style={[styles.headerIconBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Report this event"
              accessibilityHint="Opens the report form for this event"
              testID="event-report-btn"
            >
              <Icon name="flag" size="sm" color={colors.error} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.md }]}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.radiusMD,
              padding: spacing.lg,
            },
          ]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={describeEventForScreenReader(event)}
        >
          <View style={styles.badgesRow}>
            <Badge
              label={event.type === 'PHYSICAL' ? 'In person' : 'Online'}
              icon={event.type === 'PHYSICAL' ? 'location' : 'sparkles'}
              variant={event.type === 'PHYSICAL' ? 'accent' : 'info'}
              size="sm"
            />
            {event.status !== 'PUBLISHED' ? (
              <Badge label={getEventStatusLabel(event.status)} variant="warning" size="sm" />
            ) : null}
            {isSoldOut ? (
              <Badge
                label={event.isWaitlistEnabled ? 'Waitlist open' : 'Full'}
                variant={event.isWaitlistEnabled ? 'warning' : 'error'}
                size="sm"
              />
            ) : null}
          </View>

          <Heading
            level="h2"
            style={[styles.title, { color: colors.textPrimary, marginTop: spacing.sm }]}
          >
            {event.title}
          </Heading>

          {/* The host and the host community are separate destinations, so they
              are sibling targets rather than a link nested inside a link. */}
          <View style={[styles.organizerRow, { marginTop: spacing.md }]}>
            <TouchableOpacity
              style={styles.organizerLink}
              onPress={() => router.push(`/profile/${event.organizerId}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Hosted by ${event.organizer?.displayName ?? 'a community host'}`}
              accessibilityHint="Opens their profile"
              testID="event-organizer-link"
            >
              <Avatar
                name={event.organizer?.displayName || 'Organizer'}
                uri={event.organizer?.avatarUrl ?? undefined}
                size="sm"
              />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text variant="caption" color="secondary">
                  Hosted by
                </Text>
                <Text variant="body" weight="semibold" color="primary">
                  {event.organizer?.displayName || 'Community Host'}
                </Text>
              </View>
            </TouchableOpacity>
            {event.communityId ? (
              <TouchableOpacity
                onPress={() => router.push(socialRoutes.community(event.communityId as string))}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open the host community"
                accessibilityHint="Opens the community that hosts this event"
                testID="event-community-link"
              >
                <Badge
                  // `GET /v1/events/:id` returns communityName as null, so we
                  // must not render a fabricated name. The link uses the id.
                  label={event.communityName ?? 'Host community'}
                  icon="sparkle"
                  variant="neutral"
                  size="sm"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.radiusMD,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <InfoRow
            icon="calendar"
            label="Date and time"
            primary={formatEventDateRange(event.startAt, event.endAt)}
          />

          <InfoRow
            icon="location"
            label={event.type === 'ONLINE' ? 'Joining details' : 'Location'}
            primary={location.locationName}
            secondary={
              location.isRestricted
                ? (location.restrictionNotice ?? undefined)
                : (location.address ?? undefined)
            }
            secondaryTone={location.isRestricted ? 'tertiary' : 'secondary'}
            link={location.url ?? undefined}
            linkLabel={event.type === 'ONLINE' ? 'Open joining link' : 'Open venue link'}
          />

          <InfoRow
            icon="user"
            label="Attendance"
            primary={capacity.summary}
            secondary={
              capacity.waitlistEnabled
                ? 'Waitlist is open for this event.'
                : 'This event does not use a waitlist.'
            }
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <RsvpComponent client={client} eventId={event.id} event={event} />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeaderRow}>
            <Heading level="h3" color={colors.textPrimary}>
              Attendees ({event.attendeeCount})
            </Heading>
            {attendees.length > 0 ? (
              <TouchableOpacity
                onPress={() => router.push(socialRoutes.eventAttendees(event.id))}
                accessibilityRole="button"
                accessibilityLabel="View all attendees"
                accessibilityHint="Opens the full attendee list"
                testID="event-view-all-attendees"
              >
                <Text variant="caption" weight="semibold" color="accent">
                  View all
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoadingAttendees ? (
            <Text variant="caption" color="tertiary" style={{ marginTop: spacing.sm }}>
              Loading attendees...
            </Text>
          ) : attendees.length === 0 ? (
            <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
              No confirmed attendees yet.
            </Text>
          ) : (
            <View style={[styles.attendeeGrid, { marginTop: spacing.sm }]}>
              {attendees.map((att) => (
                <TouchableOpacity
                  key={att.id}
                  style={styles.attendeeChip}
                  onPress={() => router.push(`/profile/${att.userId}`)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${att.user?.displayName ?? 'Attendee'}, going`}
                  accessibilityHint="Opens their profile"
                >
                  <Avatar
                    name={att.user?.displayName || 'Attendee'}
                    uri={att.user?.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <Text
                    variant="caption"
                    color="primary"
                    numberOfLines={1}
                    style={styles.attendeeName}
                  >
                    {att.user?.displayName || 'Member'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasMoreAttendees ? (
            <TouchableOpacity
              onPress={() => router.push(socialRoutes.eventAttendees(event.id))}
              style={styles.seeAllRow}
              accessibilityRole="button"
              accessibilityLabel="See the remaining attendees"
              testID="event-attendees-see-all"
            >
              <Text variant="caption" weight="semibold" color="accent">
                See all attendees
              </Text>
              <Icon name="chevron" size="sm" direction="right" color={colors.accent} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Heading level="h3" color={colors.textPrimary} style={{ marginBottom: spacing.sm }}>
            About this event
          </Heading>
          <View
            style={[
              styles.descriptionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.radiusMD,
                padding: spacing.md,
              },
            ]}
          >
            <Text variant="body" color="secondary" style={styles.description}>
              {event.description || 'The host has not added a description.'}
            </Text>
          </View>
        </View>

        {isOrganizer && event.status !== 'CANCELLED' ? (
          <View style={{ marginTop: spacing.xl }}>
            <Heading level="h3" color={colors.textPrimary} style={{ marginBottom: spacing.sm }}>
              Hosting this event
            </Heading>
            <Text variant="caption" color="tertiary">
              Only you can see these controls.
            </Text>
            {cancelError ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.errorSoft,
                    borderRadius: radii.radiusSM,
                    padding: spacing.md,
                    marginTop: spacing.sm,
                  },
                ]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                testID="event-cancel-error"
              >
                <View style={styles.errorRow}>
                  <Icon name="alertCircle" size="sm" color={colors.error} />
                  <Text variant="caption" color="error" style={{ marginLeft: 6, flex: 1 }}>
                    {cancelError}
                  </Text>
                </View>
              </View>
            ) : null}
            <Button
              label={cancelMutation.isPending ? 'Cancelling...' : 'Cancel event'}
              variant="destructive"
              fullWidth
              style={{ marginTop: spacing.md }}
              onPress={confirmCancelEvent}
              disabled={cancelMutation.isPending}
              accessibilityLabel="Cancel this event for all attendees"
              accessibilityHint="Asks for confirmation before cancelling"
              testID="event-cancel-button"
            />
          </View>
        ) : null}
      </ScrollView>

      <ReportModal
        visible={isReportModalVisible}
        targetType="EVENT"
        targetId={event.id}
        targetName={event.title}
        onSubmit={handleReportEvent}
        onClose={() => setIsReportModalVisible(false)}
      />
    </View>
  );
};

interface InfoRowProps {
  readonly icon: IconName;
  readonly label: string;
  readonly primary: string;
  readonly secondary?: string;
  readonly secondaryTone?: 'secondary' | 'tertiary';
  readonly link?: string;
  readonly linkLabel?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  label,
  primary,
  secondary,
  secondaryTone = 'secondary',
  link,
  linkLabel,
}) => {
  const { colors, spacing } = useTheme();

  const [linkError, setLinkError] = useState<string | null>(null);

  const openLink = async () => {
    if (!link) return;
    setLinkError(null);
    try {
      await Linking.openURL(link);
    } catch {
      // `canOpenURL` is unreliable across platforms, so the failure is surfaced
      // here instead of being swallowed into a silent no-op tap.
      setLinkError('This link could not be opened.');
    }
  };

  return (
    <View style={[styles.infoRow, { marginBottom: spacing.md }]}>
      <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft, borderRadius: 999 }]}>
        <Icon name={icon} size="sm" color={colors.accentStrong} />
      </View>
      <View style={styles.infoTextCol}>
        <Text variant="caption" weight="semibold" color="secondary">
          {label}
        </Text>
        <Text variant="body" weight="medium" color="primary">
          {primary}
        </Text>
        {secondary ? (
          <Text variant="caption" color={secondaryTone}>
            {secondary}
          </Text>
        ) : null}
        {link ? (
          <>
            <TouchableOpacity
              onPress={() => void openLink()}
              style={styles.infoLink}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={linkLabel ?? 'Open link'}
              accessibilityHint="Opens outside Nazar in your browser"
              testID={`event-info-link-${icon}`}
            >
              <Text variant="caption" color="accent" numberOfLines={1}>
                {linkLabel ?? link}
              </Text>
              <Icon name="chevron" size="tiny" direction="right" color={colors.accent} />
            </TouchableOpacity>
            {linkError ? (
              <Text variant="caption" color="error" accessibilityRole="alert">
                {linkError}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    width: '100%',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  heroCard: {
    borderWidth: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  organizerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  infoCard: {
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBubble: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attendeeChip: {
    alignItems: 'center',
    maxWidth: 76,
  },
  attendeeName: {
    marginTop: 4,
    textAlign: 'center',
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  descriptionCard: {
    borderWidth: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
});
