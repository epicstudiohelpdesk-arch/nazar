import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../theme/index.js';
import type { SpacingTokens, RadiiTokens, ShadowTokens } from '../tokens/index.js';

export interface SurfaceCardProps {
  readonly p?: number | keyof SpacingTokens;
  readonly radius?: keyof RadiiTokens;
  readonly elevationLevel?: keyof ShadowTokens;
  readonly border?: boolean;
  readonly borderColor?: string;
  readonly bg?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly accessibilityRole?: 'button' | 'none';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  p = 'md',
  radius = 'radiusLG',
  elevationLevel = 'shadowSM',
  border = true,
  borderColor,
  bg,
  selected = false,
  disabled = false,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  testID,
  style,
  children,
}) => {
  const { colors, spacing, radii, shadows } = useTheme();

  const paddingVal = typeof p === 'number' ? p : spacing[p as keyof typeof spacing];
  const radiusVal = radii[radius];
  const shadowStyle = shadows[elevationLevel];

  const resolvedBorderColor = selected
    ? colors.accent
    : borderColor || colors.border;

  const cardStyle: ViewStyle = {
    backgroundColor: bg || colors.surface,
    borderRadius: radiusVal,
    padding: paddingVal,
    borderWidth: border ? (selected ? 2 : 1) : 0,
    borderColor: resolvedBorderColor,
    ...shadowStyle,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[cardStyle, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole={accessibilityRole || 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected }}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[cardStyle, disabled && styles.disabled, style]} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.55,
  },
});
