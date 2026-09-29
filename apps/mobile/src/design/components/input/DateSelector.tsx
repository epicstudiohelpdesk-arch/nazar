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
  readonly value?: string | Date | null; // e.g. YYYY-MM-DD, Date object or null
  readonly onPress?: () => void;
  readonly onChangeDate?: (date: Date) => void;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  label,
  value,
  onPress,
  onChangeDate,
  placeholder = 'Select date of birth',
  helperText,
  error,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const hasError = Boolean(error);
  const displayValue = value instanceof Date 
    ? value.toISOString().split('T')[0] 
    : (value || undefined);

  const handlePress = () => {
    if (disabled) return;
    if (onPress) {
      onPress();
    } else if (onChangeDate) {
      onChangeDate(new Date(2000, 0, 1));
    }
  };

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
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Icon name="calendar" size="sm" color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
        <Text
          variant="body"
          style={{
            color: displayValue ? colors.textPrimary : colors.textTertiary,
            flex: 1,
          }}
        >
          {displayValue || placeholder}
        </Text>
        <Icon name="chevron" direction="down" size="tiny" color={colors.textTertiary} />
      </TouchableOpacity>

      {hasError ? (
        <View style={styles.feedbackRow}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {error}
          </Text>
        </View>
      ) : helperText ? (
        <View style={styles.feedbackRow}>
          <Text variant="caption" style={{ color: colors.textTertiary }}>
            {helperText}
          </Text>
        </View>
      ) : null}
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
