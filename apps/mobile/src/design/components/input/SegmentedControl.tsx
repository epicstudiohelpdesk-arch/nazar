import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';

export interface SegmentOption<T = string> {
  readonly label: string;
  readonly value: T;
  readonly badge?: string | number;
}

export interface SegmentedControlProps<T = string> {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const SegmentedControl = <T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  style,
  testID,
}: SegmentedControlProps<T>): React.JSX.Element => {
  const { colors, radii, spacing, shadows } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.radiusMD,
          padding: spacing.xxs,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
      accessibilityRole="tablist"
      testID={testID}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            style={[
              styles.tab,
              {
                borderRadius: radii.radiusSM,
                backgroundColor: isSelected ? colors.surface : 'transparent',
                ...(isSelected ? shadows.shadowSM : {}),
              },
            ]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={option.label}
          >
            <Text
              variant="bodySmall"
              weight={isSelected ? 'semibold' : 'normal'}
              style={{
                color: isSelected ? colors.textPrimary : colors.textSecondary,
              }}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.border,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: isSelected ? colors.accentStrong : colors.textTertiary,
                    fontSize: 10,
                  }}
                >
                  {String(option.badge)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
