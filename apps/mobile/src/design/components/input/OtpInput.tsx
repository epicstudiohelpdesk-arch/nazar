import React, { useRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export interface OtpInputProps {
  readonly length?: 4 | 6;
  readonly value: string;
  readonly onChangeOtp?: (otp: string) => void;
  readonly onChangeCode?: (otp: string) => void;
  readonly onChangeText?: (otp: string) => void;
  readonly error?: string;
  readonly errorMessage?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value = '',
  onChangeOtp,
  onChangeCode,
  onChangeText,
  error,
  errorMessage,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const hiddenInputRef = useRef<RNTextInput>(null);

  const digits = Array.from({ length }, (_, i) => value.charAt(i) || '');
  const activeIndex = Math.min(value.length, length - 1);
  const effectiveError = error || errorMessage;
  const hasError = Boolean(effectiveError);

  const handleChange = (text: string) => {
    const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeOtp?.(cleanDigits);
    onChangeCode?.(cleanDigits);
    onChangeText?.(cleanDigits);
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Hidden real text input captures keystrokes and system OTP autofill */}
      <RNTextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={handleChange}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        editable={!disabled}
        style={styles.hiddenInput}
        accessibilityLabel={`Enter ${length}-digit verification code`}
      />

      {/* Visual discrete digit boxes */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hiddenInputRef.current?.focus()}
        style={styles.boxesRow}
        accessibilityRole="none"
      >
        {digits.map((digit, index) => {
          const isFocused = !disabled && (index === activeIndex || (index === length - 1 && value.length === length));
          const isFilled = Boolean(digit);

          let borderColor: string = colors.border;
          if (hasError) borderColor = colors.error;
          else if (isFocused) borderColor = colors.accent;
          else if (isFilled) borderColor = colors.borderStrong;

          return (
            <View
              key={index}
              style={[
                styles.digitBox,
                {
                  borderRadius: radii.radiusMD,
                  borderColor,
                  borderWidth: isFocused || hasError ? 2 : 1,
                  backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
                },
              ]}
            >
              <Text
                variant="heading2"
                style={{
                  color: disabled ? colors.textTertiary : colors.textPrimary,
                  textAlign: 'center',
                }}
              >
                {digit}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>

      {hasError && (
        <View style={styles.feedbackRow}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {effectiveError}
          </Text>
        </View>
      )}
    </View>
  );
};

export const OTPField = OtpInput;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  digitBox: {
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
});
