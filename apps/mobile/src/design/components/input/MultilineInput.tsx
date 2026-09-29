import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export interface MultilineInputProps extends RNTextInputProps {
  readonly label?: string;
  readonly error?: string;
  readonly hint?: string;
  readonly maxLength?: number;
  readonly minLines?: number;
  readonly disabled?: boolean;
  readonly containerStyle?: ViewStyle;
  readonly inputStyle?: TextStyle;
  readonly testID?: string;
}

export const MultilineInput: React.FC<MultilineInputProps> = ({
  label,
  error,
  hint,
  maxLength = 500,
  minLines = 4,
  disabled = false,
  containerStyle,
  inputStyle,
  testID,
  value = '',
  placeholder,
  ...rest
}) => {
  const { colors, radii, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);
  const currentLength = value?.length || 0;

  const getBorderColor = (): string => {
    if (disabled) return colors.border;
    if (hasError) return colors.error;
    if (isFocused) return colors.accent;
    return colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {label && (
        <Text
          variant="label"
          style={[styles.label, { color: hasError ? colors.error : colors.textSecondary }]}
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
            padding: spacing.sm,
            minHeight: minLines * 24 + spacing.md,
          },
        ]}
      >
        <RNTextInput
          multiline={true}
          numberOfLines={minLines}
          textAlignVertical="top"
          style={[
            styles.nativeInput,
            {
              color: disabled ? colors.textTertiary : colors.textPrimary,
            },
            inputStyle,
          ]}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label || placeholder}
          accessibilityHint={hint}
          {...rest}
        />

        {maxLength && (
          <Text
            variant="caption"
            style={[
              styles.counter,
              {
                color: currentLength >= maxLength ? colors.error : colors.textTertiary,
              },
            ]}
          >
            {currentLength}/{maxLength}
          </Text>
        )}
      </View>

      {hasError ? (
        <View style={styles.feedbackRow}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {error}
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
    position: 'relative',
  },
  nativeInput: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 80,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 4,
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
