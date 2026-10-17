import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';

export interface ProgressBarProps {
  readonly progress: number; // 0 to 100
  readonly label?: string;
  readonly showPercentage?: boolean;
  readonly color?: string;
  readonly height?: number;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = false,
  color,
  height = 8,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();

  const rawProgress = progress <= 1 && progress > 0 ? progress * 100 : progress;
  const normalized = Math.max(0, Math.min(100, rawProgress));
  const fillColor = color || colors.accent;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {(label || showPercentage) && (
        <View style={styles.labelRow}>
          {label && (
            <Text variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
              {label}
            </Text>
          )}
          {showPercentage && (
            <Text variant="caption" weight="bold" style={{ color: colors.textPrimary }}>
              {Math.round(normalized)}%
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.radiusFull,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: normalized }}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${normalized}%`,
              backgroundColor: fillColor,
              borderRadius: radii.radiusFull,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
