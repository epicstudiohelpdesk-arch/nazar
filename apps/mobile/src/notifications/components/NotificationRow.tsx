import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme, type ThemeColors } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon, type IconName } from '../../design/primitives/Icon.js';
import { MIN_TOUCH_TARGET } from '../../design/a11y/index.js';
import type { NotificationTone, NotificationViewModel } from '../notification-state.js';

export interface NotificationRowProps {
  readonly viewModel: NotificationViewModel;
  readonly onPress: (viewModel: NotificationViewModel) => void;
  readonly isBusy?: boolean;
}

/**
 * Chip colour per category tone.
 *
 * `neutral` deliberately maps to `textSecondary` rather than a status colour, so
 * an informational notification never borrows the semantics of a warning.
 */
const TONE_ICON_COLOR: Record<NotificationTone, keyof ThemeColors> = {
  accent: 'accent',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'textSecondary',
};

/**
 * One notification.
 *
 * Unread is signalled three ways at once — a leading dot, a stronger title
 * weight, and a tinted background — because the dot alone disappears for a
 * screen-reader user and for anyone who cannot separate the tints. The label in
 * {@link NotificationViewModel.accessibilityLabel} states "Unread notification"
 * in words.
 */
export const NotificationRow: React.FC<NotificationRowProps> = React.memo(
  ({ viewModel, onPress, isBusy = false }) => {
    const { colors, spacing, radii } = useTheme();
    const { notification, category, isUnread, resolved } = viewModel;

    const chipColor = colors[TONE_ICON_COLOR[category.tone]];
    const isActionable = resolved.destination !== null;

    return (
      <Pressable
        onPress={() => onPress(viewModel)}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel={viewModel.accessibilityLabel}
        accessibilityHint={viewModel.accessibilityHint}
        accessibilityState={{ disabled: isBusy, busy: isBusy }}
        testID={`notification-row-${notification.id}`}
        style={({ pressed }) => [
          styles.row,
          {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            gap: spacing.md,
            backgroundColor: isUnread ? colors.surfaceMuted : colors.background,
            borderBottomColor: colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
            // An emphasised unread row also carries a leading edge marker, so the
            // state does not rely on the fill alone.
            borderLeftWidth: isUnread && category.emphasised ? 3 : 0,
            borderLeftColor: isUnread ? colors.accent : 'transparent',
            opacity: pressed ? 0.7 : isBusy ? 0.5 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.chip,
            {
              backgroundColor: isUnread ? colors.accentSoft : colors.surface,
              borderRadius: radii.radiusFull,
            },
          ]}
        >
          <Icon name={category.icon as IconName} size="sm" color={chipColor} />
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text
              variant="label"
              color={isUnread ? 'accent' : 'tertiary'}
              style={styles.categoryLabel}
            >
              {category.label.toUpperCase()}
            </Text>
            <View style={styles.metaRow}>
              {isUnread && (
                <View
                  style={[styles.unreadDot, { backgroundColor: colors.accent }]}
                  importantForAccessibility="no"
                />
              )}
              <Text variant="caption" color="tertiary">
                {viewModel.relativeTime}
              </Text>
            </View>
          </View>

          <Text
            variant="body"
            weight={isUnread ? 'semibold' : 'normal'}
            color="primary"
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text variant="bodySmall" color="secondary" numberOfLines={2}>
            {notification.body}
          </Text>

          {!isActionable && (
            <Text variant="caption" color="tertiary" style={styles.noTarget}>
              No link available
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

NotificationRow.displayName = 'NotificationRow';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: MIN_TOUCH_TARGET + 24,
    alignItems: 'flex-start',
  },
  chip: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLabel: {
    letterSpacing: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  noTarget: {
    marginTop: 2,
    fontStyle: 'italic',
  },
});
