import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';

interface MessageComposerProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  readonly disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChangeText,
  onSend,
  disabled = false,
}) => {
  const isSendDisabled = disabled || value.trim().length === 0 || value.length > 2000;
  const remainingChars = 2000 - value.length;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Say something nice..."
          placeholderTextColor={colors.neutral[400]}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={2000}
          editable={!disabled}
          testID="message-input"
        />
        {value.length > 1800 && (
          <Text
            style={[
              styles.counterText,
              remainingChars < 0 ? styles.counterExceeded : null,
            ]}
          >
            {remainingChars}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.sendButton, isSendDisabled ? styles.sendButtonDisabled : styles.sendButtonActive]}
        onPress={onSend}
        disabled={isSendDisabled}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        testID="message-send-btn"
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[900],
    paddingTop: 0,
    paddingBottom: 0,
  },
  counterText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  counterExceeded: {
    color: colors.status.error,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary[500],
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: typography.fontSize.base,
  },
});
