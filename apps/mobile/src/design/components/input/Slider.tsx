import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';

export interface SliderProps {
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly minimumValue?: number;
  readonly maximumValue?: number;
  readonly step?: number;
  readonly value: number;
  readonly onChange?: (value: number) => void;
  readonly onValueChange?: (value: number) => void;
  readonly unit?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  minimumValue,
  maximumValue,
  step = 1,
  value,
  onChange,
  onValueChange,
  unit = '',
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();

  const effectiveMin = min ?? minimumValue ?? 0;
  const effectiveMax = max ?? maximumValue ?? 100;
  const effectiveChange = onChange || onValueChange || (() => {});

  const percentage = Math.max(
    0,
    Math.min(100, ((value - effectiveMin) / (effectiveMax - effectiveMin)) * 100)
  );

  const handleDecrease = () => {
    if (disabled) return;
    const next = Math.max(effectiveMin, value - step);
    effectiveChange(next);
  };

  const handleIncrease = () => {
    if (disabled) return;
    const next = Math.min(effectiveMax, value + step);
    effectiveChange(next);
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.labelRow}>
        {label && (
          <Text variant="label" style={{ color: colors.textSecondary }}>
            {label}
          </Text>
        )}
        <Text variant="body" weight="semibold" style={{ color: colors.accent }}>
          {value} {unit}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[
            styles.stepButton,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.radiusSM,
            },
          ]}
          onPress={handleDecrease}
          disabled={disabled || value <= effectiveMin}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label || 'value'}`}
        >
          <Text variant="title" style={{ color: colors.textPrimary }}>
            -
          </Text>
        </TouchableOpacity>

        {/* Visual Track and Fill */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.radiusFull,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: effectiveMin, max: effectiveMax, now: value }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${percentage}%`,
                backgroundColor: colors.accent,
                borderRadius: radii.radiusFull,
              },
            ]}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.stepButton,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.radiusSM,
            },
          ]}
          onPress={handleIncrease}
          disabled={disabled || value >= effectiveMax}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label || 'value'}`}
        >
          <Text variant="title" style={{ color: colors.textPrimary }}>
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  track: {
    flex: 1,
    height: 10,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
