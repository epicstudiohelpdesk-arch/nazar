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

export interface DateSelectorProps {
  readonly label?: string;
  readonly value?: string; // e.g. YYYY-MM-DD or formatted string
  readonly onPress?: () => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  label,
  value,
  onPress,
  placeholder = 'Select date of birth',
  error,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <Text
          variant="label"
          style={[styles.label, { color: hasError ? colors.error : colors.textSecondary }]}
        >
          {label}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            borderColor: hasError ? colors.error : colors.border,
            borderRadius: radii.radiusMD,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Icon name="calendar" size="sm" color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
        <Text
          variant="body"
          style={{
            color: value ? colors.textPrimary : colors.textTertiary,
            flex: 1,
          }}
        >
          {value || placeholder}
        </Text>
        <Icon name="chevron" direction="down" size="tiny" color={colors.textTertiary} />
      </TouchableOpacity>

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
  label: {
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
