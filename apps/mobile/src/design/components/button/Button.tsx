import React, { useRef } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { haptics } from '../../haptics/index.js';
import { ensureMinTouchTarget, MIN_TOUCH_TARGET } from '../../a11y/index.js';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  readonly label?: string;
  readonly children?: React.ReactNode;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconName;
  readonly leftIcon?: IconName;
  readonly rightIcon?: IconName;
  readonly iconPosition?: 'left' | 'right';
  readonly fullWidth?: boolean;
  readonly loading?: boolean;
  readonly isLoading?: boolean;
  readonly disabled?: boolean;
  readonly success?: boolean;
  readonly error?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  leftIcon,
  rightIcon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  isLoading = false,
  disabled = false,
  success = false,
  error = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const lastPressTime = useRef<number>(0);

  const isSpinning = loading || isLoading;
  const isInteractive = !disabled && !isSpinning && !success && !error;
  const buttonText = (typeof children === 'string' ? children : undefined) || label || '';

  const effectiveLeftIcon = leftIcon || (iconPosition === 'left' ? icon : undefined);
  const effectiveRightIcon = rightIcon || (iconPosition === 'right' ? icon : undefined);

  const handlePress = () => {
    if (!isInteractive || !onPress) return;
    const now = Date.now();
    // Prevent accidental rapid double tap within 400ms
    if (now - lastPressTime.current < 400) return;
    lastPressTime.current = now;
    if (variant === 'destructive') {
      haptics.warning();
    } else {
      haptics.selection();
    }
    onPress();
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 38,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          borderRadius: radii.radiusSM,
          fontSize: 13,
          iconSize: 'tiny' as const,
        };
      case 'lg':
        return {
          minHeight: 56,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderRadius: radii.radiusXL,
          fontSize: 17,
          iconSize: 'md' as const,
        };
      case 'md':
      default:
        return {
          minHeight: 48,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radii.radiusMD,
          fontSize: 15,
          iconSize: 'sm' as const,
        };
    }
  };

  const getVariantStyles = () => {
    if (success) {
      return {
        bg: colors.success,
        text: '#FFFFFF',
        border: colors.success,
      };
    }
    if (error) {
      return {
        bg: colors.error,
        text: '#FFFFFF',
        border: colors.error,
      };
    }
    switch (variant) {
      case 'primary':
        return {
          bg: colors.accent,
          text: colors.textInverse,
          border: colors.accent,
        };
      case 'secondary':
        return {
          bg: colors.surface,
          text: colors.textPrimary,
          border: colors.borderStrong,
        };
      case 'tertiary':
        return {
          bg: 'transparent',
          text: colors.accent,
          border: 'transparent',
        };
      case 'destructive':
        return {
          bg: colors.errorSoft,
          text: colors.error,
          border: colors.error,
        };
      default:
        return {
          bg: colors.accent,
          text: colors.textInverse,
          border: colors.accent,
        };
    }
  };

  const sz = getSizeStyles();
  const vs = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        styles.buttonBase,
        {
          minHeight: sz.minHeight,
          paddingHorizontal: sz.paddingHorizontal,
          paddingVertical: sz.paddingVertical,
          borderRadius: sz.borderRadius,
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderWidth: variant === 'tertiary' ? 0 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.8}
      hitSlop={sz.minHeight < MIN_TOUCH_TARGET ? ensureMinTouchTarget(MIN_TOUCH_TARGET, sz.minHeight) : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || buttonText}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !isInteractive,
        busy: isSpinning,
      }}
      testID={testID}
    >
      {isSpinning ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : success ? (
        <View style={styles.contentRow}>
          <Icon name="check" size={sz.iconSize} color={vs.text} style={{ marginRight: spacing.xs }} />
          <Text
            variant="button"
            style={[{ color: vs.text, fontSize: sz.fontSize }, textStyle]}
          >
            {buttonText}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.contentRow}>
          <Icon name="warning" size={sz.iconSize} color={vs.text} style={{ marginRight: spacing.xs }} />
          <Text
            variant="button"
            style={[{ color: vs.text, fontSize: sz.fontSize }, textStyle]}
          >
            {buttonText}
          </Text>
        </View>
      ) : (
        <View style={styles.contentRow}>
          {effectiveLeftIcon && (
            <Icon
              name={effectiveLeftIcon}
              size={sz.iconSize}
              color={vs.text}
              style={{ marginRight: spacing.xs }}
            />
          )}
          <Text
            variant="button"
            style={[{ color: vs.text, fontSize: sz.fontSize }, textStyle]}
          >
            {buttonText}
          </Text>
          {effectiveRightIcon && (
            <Icon
              name={effectiveRightIcon}
              size={sz.iconSize}
              color={vs.text}
              style={{ marginLeft: spacing.xs }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Semantic Convenience Buttons
export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<ButtonProps> = (props) => (
  <Button variant="secondary" {...props} />
);

export const TertiaryButton: React.FC<ButtonProps> = (props) => (
  <Button variant="tertiary" {...props} />
);

export const DestructiveButton: React.FC<ButtonProps> = (props) => (
  <Button variant="destructive" {...props} />
);

export const TextButton: React.FC<ButtonProps> = ({ style, ...props }) => (
  <Button
    variant="tertiary"
    style={[{ paddingHorizontal: 0, minHeight: 32 }, style]}
    {...props}
  />
);

export interface FloatingActionButtonProps {
  readonly icon: IconName;
  readonly onPress: () => void;
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly disabled?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  onPress,
  label,
  style,
  testID,
  disabled = false,
}) => {
  const { colors, radii, shadows } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: colors.accent,
          borderRadius: radii.radiusFull,
          ...shadows.shadowMD,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label || `Floating action: ${icon}`}
      testID={testID}
    >
      <Icon name={icon} size="md" color={colors.textInverse} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
});
