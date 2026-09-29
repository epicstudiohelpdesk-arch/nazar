import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput as RNTextInput,
  StyleSheet,
  ActivityIndicator,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';

export interface TextInputProps extends RNTextInputProps {
  readonly label?: string;
  readonly error?: string;
  readonly errorMessage?: string;
  readonly hint?: string;
  readonly leftIcon?: IconName;
  readonly rightIcon?: IconName;
  readonly onRightIconPress?: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly containerStyle?: ViewStyle;
  readonly inputStyle?: TextStyle;
  readonly testID?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  errorMessage,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  loading = false,
  disabled = false,
  containerStyle,
  inputStyle,
  testID,
  value,
  onFocus,
  onBlur,
  placeholder,
  ...rest
}) => {
  const { colors, radii, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const effectiveError = error || errorMessage;
  const hasValue = Boolean(value && value.length > 0);
  const hasError = Boolean(effectiveError);

  const getBorderColor = (): string => {
    if (disabled) return colors.border;
    if (hasError) return colors.error;
    if (isFocused) return colors.accent;
    if (hasValue) return colors.borderStrong;
    return colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {label && (
        <Text
          variant="label"
          style={[
            styles.label,
            { color: hasError ? colors.error : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            borderColor: getBorderColor(),
            borderWidth: isFocused || hasError ? 2 : 1,
            borderRadius: radii.radiusMD,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {leftIcon && (
          <Icon
            name={leftIcon}
            size="sm"
            color={hasError ? colors.error : isFocused ? colors.accent : colors.textTertiary}
            style={{ marginRight: spacing.sm }}
          />
        )}

        <RNTextInput
          style={[
            styles.nativeInput,
            {
              color: disabled ? colors.textTertiary : colors.textPrimary,
              paddingVertical: spacing.sm,
            },
            inputStyle,
          ]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          editable={!disabled && !loading}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          accessibilityState={{ disabled }}
          accessibilityLabel={label || placeholder}
          accessibilityHint={hint}
          {...rest}
        />

        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: spacing.xs }} />
        ) : rightIcon ? (
          onRightIconPress ? (
            <TouchableOpacity
              onPress={onRightIconPress}
              accessibilityRole="button"
              accessibilityLabel="Input action"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name={rightIcon}
                size="sm"
                color={colors.textTertiary}
                style={{ marginLeft: spacing.xs }}
              />
            </TouchableOpacity>
          ) : (
            <Icon
              name={rightIcon}
              size="sm"
              color={colors.textTertiary}
              style={{ marginLeft: spacing.xs }}
            />
          )
        ) : null}
      </View>

      {hasError ? (
        <View style={styles.feedbackRow}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {effectiveError}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" style={[styles.hint, { color: colors.textTertiary }]}>
          {hint}
        </Text>
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  nativeInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  hint: {
    marginTop: 4,
  },
});
