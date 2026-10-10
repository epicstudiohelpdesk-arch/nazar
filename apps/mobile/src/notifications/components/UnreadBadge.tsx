import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { createButtonA11y } from '../../design/a11y/index.js';

export interface UnreadBadgeProps {
  readonly count: number;
  /** Renders the numeric count. Use `false` for a bare dot. */
  readonly showCount?: boolean;
  readonly max?: number;
  readonly testID?: string;
}

/** Caps the display at `max` and renders "99+" so the pill never grows unbounded. */
export function formatBadgeCount(count: number, max = 99): string {
  const safe = Math.max(0, Math.trunc(count));
  return safe > max ? `${max}+` : String(safe);
}

/**
 * The unread indicator.
 *
 * The count is passed in rather than fetched here so there is exactly one
 * authoritative value; the profile header badge, the Activity Center header and
 * the mark-all-read affordance all render the same number.
 */
export const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  count,
  showCount = true,
  max = 99,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const safe = Math.max(0, Math.trunc(count));

  if (safe === 0) return null;

  if (!showCount) {
    return (
      <View
        testID={testID}
        style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.pill,
        {
          backgroundColor: colors.accent,
          borderRadius: radii.radiusFull,
          paddingHorizontal: spacing.xs,
          minWidth: 18,
        },
      ]}
    >
      <Text
        variant="caption"
        weight="bold"
        color="inverse"
        // The badge stays legible when Dynamic Type is enlarged, but a 3x scale
        // would break the pill's layout, so it is capped.
        maxFontSizeMultiplier={1.6}
        numberOfLines={1}
      >
        {formatBadgeCount(safe, max)}
      </Text>
    </View>
  );
};

/**
 * The accessibility label for a control carrying a badge, e.g. a bell button.
 * Keeping it here means the count is announced in words rather than skipped.
 */
export function buildBadgeA11yLabel(label: string, count: number): string {
  const safe = Math.max(0, Math.trunc(count));
  if (safe === 0) return label;
  return `${label}, ${safe} unread`;
}

export { createButtonA11y };

const styles = StyleSheet.create({
  pill: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
