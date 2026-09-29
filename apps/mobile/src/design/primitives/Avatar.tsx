import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';
import { Icon } from './Icon.js';

export type AvatarSize = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | number;

export interface AvatarProps {
  readonly uri?: string | null;
  readonly name?: string;
  readonly size?: AvatarSize;
  readonly isOnline?: boolean;
  readonly isVerified?: boolean;
  readonly isLoading?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

const resolveAvatarDimension = (size: AvatarSize): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'tiny':
      return 24;
    case 'small':
      return 32;
    case 'medium':
      return 44;
    case 'large':
      return 64;
    case 'xlarge':
      return 96;
    default:
      return 44;
  }
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = 'Nazar',
  size = 'medium',
  isOnline,
  isVerified,
  isLoading = false,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const dimension = resolveAvatarDimension(size);
  const initials = name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const badgeOffset = dimension > 44 ? 2 : 0;
  const badgeSize = Math.max(8, Math.round(dimension * 0.26));

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

      {/* Online presence dot - strictly rendered only when backend boolean is provided */}
      {isOnline === true && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: colors.success,
              borderColor: colors.surface,
              bottom: badgeOffset,
              right: badgeOffset,
            },
          ]}
          accessibilityLabel="Online now"
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
