import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { useReducedMotion } from '../../design/motion/index.js';

export interface TypingIndicatorProps {
  readonly isTyping: boolean;
  readonly displayName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping, displayName }) => {
  const { colors, radii, spacing } = useTheme();
  const isReduced = useReducedMotion();
  const anim1 = useRef(new Animated.Value(0.3)).current;
  const anim2 = useRef(new Animated.Value(0.3)).current;
  const anim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!isTyping) return;

    if (isReduced) {
      anim1.setValue(0.75);
      anim2.setValue(0.75);
      anim3.setValue(0.75);
      return;
    }

    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const pulse1 = createPulse(anim1, 0);
    const pulse2 = createPulse(anim2, 200);
    const pulse3 = createPulse(anim3, 400);

    pulse1.start();
    pulse2.start();
    pulse3.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
    };
  }, [isTyping, anim1, anim2, anim3]);

  if (!isTyping) {
    return null;
  }

  const label = displayName ? `${displayName} is typing...` : 'Typing...';

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
      testID="typing-indicator"
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radii.radiusFull,
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
          },
        ]}
      >
        <Text
          variant="caption"
          weight="medium"
          style={{ color: colors.textSecondary, marginRight: spacing.xs, fontSize: 12 }}
        >
          {label}
        </Text>
        <View style={styles.dotsRow}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: colors.accent, opacity: anim1 },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: colors.accent, opacity: anim2 },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: colors.accent, opacity: anim3 },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 1.5,
  },
});
