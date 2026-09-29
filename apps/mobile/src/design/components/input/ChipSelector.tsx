import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export interface ChipItem<T = string> {
  readonly id: T;
  readonly label: string;
}

export interface ChipSelectorProps<T = string> {
  readonly label?: string;
  readonly items?: readonly ChipItem<T>[];
  readonly options?: readonly ChipItem<T>[];
  readonly selectedIds?: readonly T[];
  readonly selectedValues?: readonly T[];
  readonly onToggle?: (id: T) => void;
  readonly onToggleValue?: (id: T) => void;
  readonly maxSelection?: number;
  readonly maxSelectable?: number;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const ChipSelector = <T extends string | number>({
  label,
  items,
  options,
  selectedIds,
  selectedValues,
  onToggle,
  onToggleValue,
  maxSelection,
  maxSelectable,
  error,
  disabled = false,
  style,
  testID,
}: ChipSelectorProps<T>): React.JSX.Element => {
  const { colors, radii, spacing } = useTheme();
  const effectiveItems = items || options || [];
  const effectiveSelected = selectedIds || selectedValues || [];
  const effectiveToggle = onToggle || onToggleValue || (() => {});
  const effectiveMax = maxSelection || maxSelectable;
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <View style={styles.headerRow}>
          <Text
            variant="label"
            style={{ color: hasError ? colors.error : colors.textSecondary }}
          >
            {label}
          </Text>
          {effectiveMax !== undefined && (
            <Text variant="caption" style={{ color: colors.textTertiary }}>
              {effectiveSelected.length}/{effectiveMax}
            </Text>
          )}
        </View>
      )}

      <View style={styles.chipsWrap}>
        {effectiveItems.map((item) => {
          const isSelected = effectiveSelected.includes(item.id);
          const reachedMax = Boolean(
            effectiveMax && effectiveSelected.length >= effectiveMax && !isSelected
          );
          const isChipDisabled = disabled || reachedMax;

          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[
                styles.chip,
                {
                  borderRadius: radii.radiusFull,
                  backgroundColor: isSelected
                    ? colors.accentSoft
                    : colors.surfaceMuted,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: 1,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  opacity: isChipDisabled ? 0.45 : 1,
                },
              ]}
              onPress={() => effectiveToggle(item.id)}
              disabled={isChipDisabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isChipDisabled }}
              accessibilityLabel={item.label}
            >
              {isSelected && (
                <Icon
                  name="check"
                  size="tiny"
                  color={colors.accentStrong}
                  style={{ marginRight: spacing.xxs }}
                />
              )}
              <Text
                variant="bodySmall"
                weight={isSelected ? 'semibold' : 'normal'}
                style={{
                  color: isSelected ? colors.accentStrong : colors.textPrimary,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hasError && (
        <View style={styles.feedbackRow}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
});
