import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Button } from '../../components/button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- EVENT DATE BADGE ---
export interface EventDateBadgeProps {
  readonly month: string;
  readonly day: string | number;
  readonly style?: StyleProp<ViewStyle>;
}

export const EventDateBadge: React.FC<EventDateBadgeProps> = ({ month, day, style }) => {
  const { colors, radii } = useTheme();

  return (
    <View
      style={[
        styles.dateBadge,
        {
          backgroundColor: colors.accentSoft,
          borderColor: colors.accent,
          borderRadius: radii.radiusMD,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Date: ${month} ${day}`}
    >
      <Text variant="caption" weight="bold" style={{ color: colors.accentStrong, fontSize: 10 }}>
        {month.toUpperCase()}
      </Text>
      <Text variant="title" weight="bold" style={{ color: colors.accentStrong, fontSize: 18 }}>
        {day}
      </Text>
    </View>
  );
};

// --- EVENT LOCATION ---
export interface EventLocationProps {
  readonly venue: string;
  readonly city?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const EventLocation: React.FC<EventLocationProps> = ({ venue, city, style }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.locationRow, style]}>
      <Icon name="location" size="tiny" color={colors.textTertiary} style={{ marginRight: 4 }} />
      <Text variant="caption" style={{ color: colors.textSecondary }} numberOfLines={1}>
        {venue}
        {city ? `, ${city}` : ''}
      </Text>
    </View>
  );
};

// --- RSVP BUTTON ---
export interface RSVPButtonProps {
  readonly status: 'none' | 'interested' | 'going';
  readonly onRSVP: (status: 'interested' | 'going') => void;
  readonly isLoading?: boolean;
}

export const RSVPButton: React.FC<RSVPButtonProps> = ({ status, onRSVP, isLoading = false }) => {
  const isGoing = status === 'going';

  return (
    <Button
      label={isGoing ? 'Attending' : 'RSVP'}
      variant={isGoing ? 'primary' : 'secondary'}
      size="sm"
      onPress={() => onRSVP(isGoing ? 'interested' : 'going')}
      isLoading={isLoading}
      icon={isGoing ? 'check' : 'calendar'}
    />
  );
};

// --- CAPACITY INDICATOR ---
export interface CapacityIndicatorProps {
  readonly attendingCount: number;
  readonly maxCapacity?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const CapacityIndicator: React.FC<CapacityIndicatorProps> = ({
  attendingCount,
  maxCapacity,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.capacityRow, style]}>
      <Icon name="user" size="tiny" color={colors.textTertiary} style={{ marginRight: 4 }} />
      <Text variant="caption" style={{ color: colors.textSecondary }}>
        {attendingCount} attending
        {maxCapacity ? ` (${Math.max(0, maxCapacity - attendingCount)} spots left)` : ''}
      </Text>
    </View>
  );
};

// --- EVENT STATUS BADGE ---
export interface EventStatusBadgeProps {
  readonly status: 'upcoming' | 'sold_out' | 'passed';
  readonly style?: StyleProp<ViewStyle>;
}

export const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({ status, style }) => {
  const { colors, radii } = useTheme();

  const getStyle = () => {
    switch (status) {
      case 'sold_out':
        return { bg: colors.errorSoft, text: colors.error, label: 'Sold Out' };
      case 'passed':
        return { bg: colors.surfaceMuted, text: colors.textTertiary, label: 'Ended' };
      case 'upcoming':
      default:
        return { bg: colors.successSoft, text: colors.success, label: 'Open' };
    }
  };

  const badgeConfig = getStyle();

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: badgeConfig.bg, borderRadius: radii.radiusFull },
        style,
      ]}
    >
      <Text variant="caption" weight="bold" style={{ color: badgeConfig.text, fontSize: 10 }}>
        {badgeConfig.label}
      </Text>
    </View>
  );
};

// --- EVENT HEADER ---
export interface EventHeaderProps {
  readonly title: string;
  readonly month: string;
  readonly day: string | number;
  readonly venue: string;
  readonly city?: string;
  readonly status?: 'upcoming' | 'sold_out' | 'passed';
  readonly attendingCount: number;
  readonly maxCapacity?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const EventHeader: React.FC<EventHeaderProps> = ({
  title,
  month,
  day,
  venue,
  city,
  status = 'upcoming',
  attendingCount,
  maxCapacity,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[styles.eventHeader, { backgroundColor: colors.surface, padding: spacing.md }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <EventDateBadge month={month} day={day} style={{ marginRight: spacing.md }} />
        <View style={{ flex: 1 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Heading level="h2" style={{ flex: 1, marginRight: spacing.xs }}>
              {title}
            </Heading>
            <EventStatusBadge status={status} />
          </View>
          <EventLocation venue={venue} city={city} style={{ marginTop: 4 }} />
          <CapacityIndicator
            attendingCount={attendingCount}
            maxCapacity={maxCapacity}
            style={{ marginTop: 2 }}
          />
        </View>
      </View>
    </View>
  );
};

// --- EVENT CARD ---
export interface EventFeedCardProps {
  readonly id: string;
  readonly title: string;
  readonly month: string;
  readonly day: string | number;
  readonly venue: string;
  readonly city?: string;
  readonly attendingCount: number;
  readonly status?: 'upcoming' | 'sold_out' | 'passed';
  readonly rsvpStatus?: 'none' | 'interested' | 'going';
  readonly onRSVP?: (status: 'interested' | 'going') => void;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const EventFeedCard: React.FC<EventFeedCardProps> = ({
  title,
  month,
  day,
  venue,
  city,
  attendingCount,
  status = 'upcoming',
  rsvpStatus = 'none',
  onRSVP,
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <SurfaceCard
      p="md"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.cardRow}>
        <EventDateBadge month={month} day={day} style={{ marginRight: spacing.md }} />

        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text
            variant="title"
            weight="bold"
            style={{ color: colors.textPrimary }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <EventLocation venue={venue} city={city} style={{ marginTop: 2 }} />
          <CapacityIndicator attendingCount={attendingCount} style={{ marginTop: 2 }} />
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <EventStatusBadge status={status} />
          {onRSVP && <RSVPButton status={rsvpStatus} onRSVP={onRSVP} />}
        </View>
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  dateBadge: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  eventHeader: {
    width: '100%',
  },
  card: {
    width: '100%',
    marginVertical: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
