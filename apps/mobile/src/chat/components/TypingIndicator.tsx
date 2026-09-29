import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';

interface TypingIndicatorProps {
  readonly isTyping: boolean;
  readonly displayName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping, displayName }) => {
  if (!isTyping) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{displayName ? `${displayName} is typing` : 'Typing'}</Text>
        <View style={styles.dotsRow}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  text: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[700],
    marginRight: spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[400],
    marginHorizontal: 1.5,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
});
