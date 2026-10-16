import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { haptics } from '../../design/haptics/index.js';
import { ensureMinTouchTarget } from '../../design/a11y/index.js';

export interface MessageComposerProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChangeText,
  onSend,
  disabled = false,
  placeholder = 'Say something nice...',
}) => {
  const { colors, radii, spacing } = useTheme();

  const trimmed = value.trim();
  const isSendDisabled = disabled || trimmed.length === 0 || value.length > 2000;
  const remainingChars = 2000 - value.length;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <View style={styles.innerWrapper}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.radiusLG,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={2000}
            editable={!disabled}
            testID="message-input"
            accessibilityLabel="Message input"
          />
          {value.length > 1800 && (
            <Text
              variant="caption"
              style={{
                color: remainingChars < 0 ? colors.error : colors.textTertiary,
                alignSelf: 'flex-end',
                fontSize: 10,
                marginTop: 2,
              }}
            >
              {remainingChars}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: isSendDisabled ? colors.surfaceMuted : colors.accent,
              borderRadius: radii.radiusFull,
              marginLeft: spacing.sm,
            },
          ]}
          onPress={() => {
            haptics.selection();
            onSend();
          }}
          disabled={isSendDisabled}
          hitSlop={ensureMinTouchTarget(40, 40)}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          testID="message-send-btn"
        >
          <Icon
            name="send"
            size="sm"
            color={isSendDisabled ? colors.textTertiary : colors.textInverse}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    width: '100%',
  },
  innerWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    paddingTop: 6,
    paddingBottom: 6,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
