import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { Button } from '../button/Button.js';

export type EmptyStateType =
  | 'no_matches'
  | 'noMatches'
  | 'no_conversations'
  | 'noMessages'
  | 'no_notifications'
  | 'noNotifications'
  | 'no_communities'
  | 'noCommunities'
  | 'no_events'
  | 'noEvents'
  | 'no_likes'
  | 'noLikes'
  | 'no_saved'
  | 'noResults'
  | 'generic';

export interface EmptyStateAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface EmptyStateProps {
  readonly type?: EmptyStateType;
  readonly title?: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly primaryAction?: EmptyStateAction;
  readonly secondaryAction?: EmptyStateAction;
  readonly icon?: IconName;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

interface StateContent {
  title: string;
  description: string;
  actionLabel?: string;
  icon: IconName;
}

const DEFAULT_EMPTY_CONFIG: Record<string, StateContent> = {
  no_matches: {
    title: 'No matches yet',
    description:
      'Connections take time. Keep exploring discovery profiles to find people who share your wavelength.',
    actionLabel: 'Explore Discovery',
    icon: 'heart',
  },
  noMatches: {
    title: 'No matches yet',
    description:
      'Connections take time. Keep exploring discovery profiles to find people who share your wavelength.',
    actionLabel: 'Explore Discovery',
    icon: 'heart',
  },
  no_conversations: {
    title: 'No conversations yet',
    description:
      'When you and someone like each other, your conversations will appear here. Break the ice with a thoughtful note.',
    actionLabel: 'Find Matches',
    icon: 'message',
  },
  noMessages: {
    title: 'No conversations yet',
    description:
      'When you and someone like each other, your conversations will appear here. Break the ice with a thoughtful note.',
    actionLabel: 'Find Matches',
    icon: 'message',
  },
  no_notifications: {
    title: 'All caught up',
    description:
      'You have no new alerts. When someone likes your profile, messages you, or an event starts, we will notify you here.',
    actionLabel: undefined,
    icon: 'bell',
  },
  noNotifications: {
    title: 'All caught up',
    description:
      'You have no new alerts. When someone likes your profile, messages you, or an event starts, we will notify you here.',
    actionLabel: undefined,
    icon: 'bell',
  },
  no_communities: {
    title: 'Discover your circles',
    description:
      'Join clubs centered around literature, chai, startups, food, and culture to connect naturally.',
    actionLabel: 'Browse Communities',
    icon: 'user',
  },
  noCommunities: {
    title: 'Discover your circles',
    description:
      'Join clubs centered around literature, chai, startups, food, and culture to connect naturally.',
    actionLabel: 'Browse Communities',
    icon: 'user',
  },
  no_events: {
    title: 'No upcoming events',
    description:
      'Curated city mixers and cultural meetups will appear here. Check back soon for upcoming gatherings in your area.',
    actionLabel: 'Refresh Events',
    icon: 'calendar',
  },
  noEvents: {
    title: 'No upcoming events',
    description:
      'Curated city mixers and cultural meetups will appear here. Check back soon for upcoming gatherings in your area.',
    actionLabel: 'Refresh Events',
    icon: 'calendar',
  },
  no_likes: {
    title: 'No likes received yet',
    description:
      'Refining your prompts and adding authentic photos helps more people discover and appreciate who you are.',
    actionLabel: 'Edit Profile',
    icon: 'sparkles',
  },
  noLikes: {
    title: 'No likes received yet',
    description:
      'Refining your prompts and adding authentic photos helps more people discover and appreciate who you are.',
    actionLabel: 'Edit Profile',
    icon: 'sparkles',
  },
  noResults: {
    title: 'No results found',
    description: 'Try adjusting your search terms or expanding your filter radius.',
    actionLabel: 'Clear Search',
    icon: 'search',
  },
  no_saved: {
    title: 'No saved items',
    description:
      'Profiles, community posts, and events you bookmark for later will be stored safely here.',
    actionLabel: 'Explore',
    icon: 'shield',
  },
  generic: {
    title: 'Nothing here yet',
    description:
      'This space is currently empty. Explore the app to start building your journey.',
    actionLabel: 'Continue',
    icon: 'sparkles',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  primaryAction,
  secondaryAction,
  icon,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const fallbackConfig: StateContent = DEFAULT_EMPTY_CONFIG.generic!;
  const defaults = DEFAULT_EMPTY_CONFIG[type] ?? fallbackConfig;

  const resolvedTitle = title || defaults.title;
  const resolvedDesc = description || defaults.description;
  const resolvedIcon = icon || defaults.icon;

  const effectivePrimary =
    primaryAction ||
    (actionLabel && onAction
      ? { label: actionLabel, onPress: onAction }
      : defaults.actionLabel && onAction
      ? { label: defaults.actionLabel, onPress: onAction }
      : undefined);

  return (
    <View
      style={[styles.container, { padding: spacing.xl }, style]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`${resolvedTitle}. ${resolvedDesc}`}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radii.radiusFull,
          },
        ]}
      >
        <Icon name={resolvedIcon} size="lg" color={colors.accent} />
      </View>

      <Heading level="h3" align="center" style={{ marginTop: spacing.md }}>
        {resolvedTitle}
      </Heading>

      <Text
        variant="body"
        align="center"
        style={{
          color: colors.textSecondary,
          marginTop: spacing.xs,
          marginBottom: spacing.lg,
          lineHeight: 22,
        }}
      >
        {resolvedDesc}
      </Text>

      <View style={styles.actionColumn}>
        {effectivePrimary && (
          <Button
            label={effectivePrimary.label}
            variant="primary"
            size="md"
            onPress={effectivePrimary.onPress}
            style={{ marginBottom: secondaryAction ? spacing.xs : 0 }}
          />
        )}

        {secondaryAction && (
          <Button
            label={secondaryAction.label}
            variant="tertiary"
            size="md"
            onPress={secondaryAction.onPress}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionColumn: {
    alignItems: 'center',
    width: '100%',
  },
});
