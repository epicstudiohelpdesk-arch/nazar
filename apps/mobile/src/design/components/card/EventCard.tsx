import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Badge } from '../../primitives/Badge.js';
import { Button } from '../button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export interface EventCardProps {
  readonly id: string;
  readonly title: string;
  readonly dateFormatted: string; // e.g. "Sat, Oct 12 · 7:00 PM"
  readonly location: string;
  readonly attendeeCount: number;
  readonly rsvpStatus?: 'attending' | 'interested' | 'not_going' | null;
  readonly onRsvp?: () => void;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const EventCard: React.FC<EventCardProps> = ({
  id,
  title,
  dateFormatted,
  location,
  attendeeCount,
  rsvpStatus,
  onRsvp,
  onPress,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const isAttending = rsvpStatus === 'attending';

  return (
    <SurfaceCard
      p="md"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `event-card-${id}`}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.calendarBadge,
            { backgroundColor: colors.accentSoft, borderRadius: radii.radiusSM },
          ]}
        >
          <Icon name="calendar" size="sm" color={colors.accent} />
          <Text
            variant="caption"
            weight="bold"
            style={{ color: colors.accentStrong, marginTop: 2 }}
          >
            {dateFormatted.slice(0, 3).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Heading level="title" numberOfLines={1}>
            {title}
          </Heading>
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {dateFormatted}
          </Text>
          <View style={styles.locationRow}>
            <Icon
              name="location"
              size="tiny"
              color={colors.textTertiary}
              style={{ marginRight: 4 }}
            />
            <Text variant="caption" style={{ color: colors.textTertiary }} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.bottomRow,
          { borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.xs },
        ]}
      >
        <Badge
          label={`${attendeeCount} going`}
          variant={isAttending ? 'success' : 'neutral'}
          size="sm"
        />

        {onRsvp && (
          <Button
            label={isAttending ? 'Going ✓' : 'RSVP'}
            variant={isAttending ? 'secondary' : 'primary'}
            size="sm"
            onPress={onRsvp}
          />
        )}
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarBadge: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
});
