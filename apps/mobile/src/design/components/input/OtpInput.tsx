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
  readonly onComplete?: (code: string) => void;
  readonly autoFocus?: boolean;
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
  onComplete,
  autoFocus = false,
  error,
  errorMessage,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, spacing, isDark } = useTheme();
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
    if (cleanDigits.length === length) {
      onComplete?.(cleanDigits);
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Box container holding discrete cells and full touch hit-area text input */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hiddenInputRef.current?.focus()}
        style={styles.inputBoxContainer}
        accessibilityRole="none"
      >
        {/* Visual discrete digit boxes */}
        <View style={styles.boxesRow} pointerEvents="none">
          {digits.map((digit, index) => {
            const isFocused =
              !disabled &&
              (index === activeIndex || (index === length - 1 && value.length === length));
            const isFilled = Boolean(digit);

            let borderColor: string = isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border;
            if (hasError) borderColor = colors.error;
            else if (isFocused) borderColor = isDark ? '#FFFFFF' : '#1C1917';
            else if (isFilled)
              borderColor = isDark ? 'rgba(255, 255, 255, 0.45)' : colors.borderStrong;

            return (
              <View
                key={index}
                style={[
                  styles.digitBox,
                  {
                    borderRadius: 14,
                    borderColor,
                    borderWidth: isFocused || hasError ? 1.5 : 1,
                    backgroundColor: disabled
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.02)'
                        : colors.surfaceMuted
                      : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : colors.surface,
                  },
                ]}
              >
                <Text
                  variant="heading2"
                  style={{
                    color: disabled ? colors.textTertiary : colors.textPrimary,
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: '700',
                  }}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Real text input overlay captures keystrokes and iOS SMS autofill directly */}
        <RNTextInput
          ref={hiddenInputRef}
          value={value}
          onChangeText={handleChange}
          maxLength={length}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoCorrect={false}
          spellCheck={false}
          keyboardAppearance="dark"
          editable={!disabled}
          autoFocus={autoFocus}
          style={styles.hiddenInputOverlay}
          accessibilityLabel={`Enter ${length}-digit verification code`}
        />
      </TouchableOpacity>

      {hasError && (
        <View style={styles.feedbackRow}>
          <Icon
            name="warning"
            size="tiny"
            color={colors.error}
            style={{ marginRight: spacing.xxs }}
          />
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
  inputBoxContainer: {
    width: '100%',
    maxWidth: 340,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInputOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
    color: 'transparent',
    fontSize: 24,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  digitBox: {
    flex: 1,
    maxWidth: 46,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
});
