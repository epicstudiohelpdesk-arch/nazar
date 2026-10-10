import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';
import { Icon } from './Icon.js';

export type AvatarSize =
  'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | number;

export interface AvatarProps {
  readonly uri?: string | null;
  readonly name?: string;
  readonly size?: AvatarSize;
  readonly isOnline?: boolean;
  readonly isVerified?: boolean;
  readonly isLoading?: boolean;
  readonly status?: 'active' | 'busy' | 'away';
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const resolveAvatarDimension = (size: AvatarSize): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'xs':
    case 'tiny':
      return 24;
    case 'sm':
    case 'small':
      return 32;
    case 'md':
    case 'medium':
      return 44;
    case 'lg':
    case 'large':
      return 64;
    case 'xl':
    case 'xlarge':
      return 96;
    default:
      return 44;
  }
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = 'Nazar',
  size = 'md',
  isOnline,
  isVerified,
  isLoading = false,
  status,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const dimension = resolveAvatarDimension(size);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'N';

  const badgeOffset = dimension > 44 ? 2 : 0;
  const badgeSize = Math.max(8, Math.round(dimension * 0.26));

  const resolveStatusColor = (): string | undefined => {
    if (status === 'active' || isOnline === true) return colors.success;
    if (status === 'busy') return colors.error;
    if (status === 'away') return colors.warning;
    return undefined;
  };

  const statusColor = resolveStatusColor();

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar of ${name}${isVerified ? ', verified user' : ''}`}
      testID={testID || `avatar-${name}`}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : uri ? (
        <Image
          source={{ uri }}
          style={{
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          }}
          resizeMode="cover"
        />
      ) : (
        <Text
          variant={dimension > 44 ? 'bodyLarge' : 'caption'}
          weight="semibold"
          style={{
            color: colors.accentStrong,
            fontSize: Math.max(10, Math.round(dimension * 0.38)),
          }}
        >
          {initials}
        </Text>
      )}

      {/* Online presence / status indicator */}
      {statusColor && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: statusColor,
              borderColor: colors.surface,
              bottom: badgeOffset,
              right: badgeOffset,
            },
          ]}
          accessibilityLabel={status ? `Status: ${status}` : 'Online now'}
        />
      )}

      {/* Verified safety badge */}
      {isVerified === true && (
        <View
          style={[
            styles.verifiedBadge,
            {
              width: badgeSize + 2,
              height: badgeSize + 2,
              borderRadius: (badgeSize + 2) / 2,
              backgroundColor: colors.info,
              borderColor: colors.surface,
              top: badgeOffset,
              right: badgeOffset,
            },
          ]}
          accessibilityLabel="Verified account"
        >
          <Icon name="check" size={Math.max(8, badgeSize - 4)} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      )}
    </View>
  );
};

// Convenience Size Variants
export const AvatarXS: React.FC<Omit<AvatarProps, 'size'>> = (props) => (
  <Avatar size="xs" {...props} />
);
export const AvatarSM: React.FC<Omit<AvatarProps, 'size'>> = (props) => (
  <Avatar size="sm" {...props} />
);
export const AvatarMD: React.FC<Omit<AvatarProps, 'size'>> = (props) => (
  <Avatar size="md" {...props} />
);
export const AvatarLG: React.FC<Omit<AvatarProps, 'size'>> = (props) => (
  <Avatar size="lg" {...props} />
);
export const AvatarXL: React.FC<Omit<AvatarProps, 'size'>> = (props) => (
  <Avatar size="xl" {...props} />
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  onlineBadge: {
    position: 'absolute',
    borderWidth: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
