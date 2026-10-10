import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';
import { Icon, type IconName } from './Icon.js';

export type BadgeVariant = 'accent' | 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'gold';

export interface BadgeProps {
  readonly label: string;
  readonly variant?: BadgeVariant;
  readonly icon?: IconName;
  readonly size?: 'sm' | 'md';
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  size = 'md',
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return {
          bg: colors.accentSoft,
          text: colors.accentStrong,
          border: colors.accent,
        };
      case 'success':
        return {
          bg: colors.successSoft,
          text: colors.success,
          border: colors.success,
        };
      case 'warning':
        return {
          bg: colors.warningSoft,
          text: colors.warning,
          border: colors.warning,
        };
      case 'error':
        return {
          bg: colors.errorSoft,
          text: colors.error,
          border: colors.error,
        };
      case 'info':
        return {
          bg: colors.infoSoft,
          text: colors.info,
          border: colors.info,
        };
      case 'gold':
        return {
          bg: '#FEF3C7',
          text: '#92400E',
          border: '#F59E0B',
        };
      case 'neutral':
      default:
        return {
          bg: colors.surfaceMuted,
          text: colors.textSecondary,
          border: colors.border,
        };
    }
  };

  const v = getVariantStyles();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderRadius: radii.radiusFull,
          paddingHorizontal: isSm ? spacing.xs : spacing.sm,
          paddingVertical: isSm ? 2 : spacing.xxs,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`Badge: ${label}`}
    >
      {icon && (
        <Icon
          name={icon}
          size={isSm ? 'tiny' : 'sm'}
          color={v.text}
          style={{ marginRight: spacing.xxs }}
        />
      )}
      <Text
        variant="caption"
        style={{
          color: v.text,
          fontWeight: '600',
          fontSize: isSm ? 11 : 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
