import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Icon, type IconName, type IconSize } from '../../primitives/Icon.js';
import { haptics } from '../../haptics/index.js';
import { ensureMinTouchTarget, MIN_TOUCH_TARGET } from '../../a11y/index.js';

export type IconButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  readonly icon: IconName;
  readonly onPress?: () => void;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly success?: boolean;
  readonly error?: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  success = false,
  error = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}) => {
  const { colors, radii } = useTheme();

  const isInteractive = !disabled && !loading && !success && !error;

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          dimension: 38,
          iconSize: 'sm' as IconSize,
          borderRadius: radii.radiusSM,
        };
      case 'lg':
        return {
          dimension: 56,
          iconSize: 'lg' as IconSize,
          borderRadius: radii.radiusXL,
        };
      case 'md':
      default:
        return {
          dimension: 44,
          iconSize: 'md' as IconSize,
          borderRadius: radii.radiusMD,
        };
    }
  };

  const getVariantStyles = () => {
    if (success) {
      return {
        bg: colors.successSoft,
        iconColor: colors.success,
        border: colors.success,
      };
    }
    if (error) {
      return {
        bg: colors.errorSoft,
        iconColor: colors.error,
        border: colors.error,
      };
    }
    switch (variant) {
      case 'primary':
        return {
          bg: colors.accent,
          iconColor: colors.textInverse,
          border: colors.accent,
        };
      case 'secondary':
        return {
          bg: colors.surface,
          iconColor: colors.textPrimary,
          border: colors.border,
        };
      case 'tertiary':
        return {
          bg: 'transparent',
          iconColor: colors.textSecondary,
          border: 'transparent',
        };
      case 'destructive':
        return {
          bg: colors.errorSoft,
          iconColor: colors.error,
          border: colors.error,
        };
      default:
        return {
          bg: colors.surface,
          iconColor: colors.textPrimary,
          border: colors.border,
        };
    }
  };

  const sz = getSizeStyles();
  const vs = getVariantStyles();

  const handlePress = () => {
    if (!isInteractive || !onPress) return;
    if (variant === 'destructive') {
      haptics.warning();
    } else {
      haptics.selection();
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.iconButtonBase,
        {
          width: sz.dimension,
          height: sz.dimension,
          borderRadius: sz.borderRadius,
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderWidth: variant === 'tertiary' ? 0 : 1,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.8}
      hitSlop={sz.dimension < MIN_TOUCH_TARGET ? ensureMinTouchTarget(sz.dimension) : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !isInteractive,
        busy: loading,
      }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.iconColor} />
      ) : success ? (
        <Icon name="check" size={sz.iconSize} color={vs.iconColor} />
      ) : error ? (
        <Icon name="warning" size={sz.iconSize} color={vs.iconColor} />
      ) : (
        <Icon name={icon} size={sz.iconSize} color={vs.iconColor} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconButtonBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
