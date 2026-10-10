import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export type MediaAspectRatio = '1:1' | '4:5' | '3:4' | '16:9' | 'fullBleed';

export interface MediaCardProps {
  readonly uri?: string | null;
  readonly aspectRatio?: MediaAspectRatio;
  readonly caption?: string;
  readonly photoCount?: number;
  readonly isBlurred?: boolean;
  readonly isRestricted?: boolean;
  readonly restrictionNotice?: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

const resolveAspectRatioNumber = (ratio: MediaAspectRatio): number => {
  switch (ratio) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '3:4':
      return 3 / 4;
    case '16:9':
      return 16 / 9;
    case 'fullBleed':
    default:
      return 9 / 16;
  }
};

export const MediaCard: React.FC<MediaCardProps> = ({
  uri,
  aspectRatio = '4:5',
  caption,
  photoCount,
  isBlurred = false,
  isRestricted = false,
  restrictionNotice = 'Private media. Match required to view.',
  onPress,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();
  const ratioNumber = resolveAspectRatioNumber(aspectRatio);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          aspectRatio: ratioNumber,
          borderRadius: radii.radiusLG,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.9}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={caption || 'Media item'}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { borderRadius: radii.radiusLG }, isBlurred && styles.blurredImage]}
          resizeMode="cover"
          blurRadius={isBlurred ? 25 : 0}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="camera" size="lg" color={colors.textTertiary} />
        </View>
      )}

      {/* Restricted Overlay */}
      {isRestricted && (
        <View style={[styles.restrictedOverlay, { backgroundColor: colors.overlay }]}>
          <Icon name="lock" size="md" color="#FFFFFF" />
          <Text
            variant="caption"
            weight="medium"
            style={{ color: '#FFFFFF', textAlign: 'center', marginTop: 8 }}
          >
            {restrictionNotice}
          </Text>
        </View>
      )}

      {/* Top Photo Count Indicator */}
      {photoCount && photoCount > 1 ? (
        <View style={[styles.countBadge, { borderRadius: radii.radiusFull }]}>
          <Icon name="camera" size="tiny" color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
            {photoCount}
          </Text>
        </View>
      ) : null}

      {/* Bottom Caption Overlay */}
      {caption && (
        <View style={[styles.captionOverlay, { backgroundColor: colors.scrim }]}>
          <Text variant="bodySmall" style={{ color: '#FFFFFF' }}>
            {caption}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.8,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
});
