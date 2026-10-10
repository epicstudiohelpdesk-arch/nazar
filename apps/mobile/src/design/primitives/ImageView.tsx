import React, { useState } from 'react';
import {
  View,
  Image as RNImage,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  type ImageProps as RNImageProps,
  type ImageStyle,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';
import { Icon, type IconName } from './Icon.js';

export type ImageAspectRatio =
  'square' | 'portrait' | 'landscape' | 'fullBleed' | 'thumbnail' | number;

export interface ImageViewProps extends Omit<RNImageProps, 'source'> {
  readonly uri?: string | null;
  readonly source?: RNImageProps['source'];
  readonly aspectRatio?: ImageAspectRatio;
  readonly rounded?: boolean | number;
  readonly isBlurred?: boolean;
  readonly isRestricted?: boolean;
  readonly restrictionMessage?: string;
  readonly placeholderIcon?: IconName;
  readonly onRetry?: () => void;
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly style?: StyleProp<ImageStyle>;
  readonly testID?: string;
}

export const ImageView: React.FC<ImageViewProps> = ({
  uri,
  source,
  aspectRatio = 'portrait',
  rounded = true,
  isBlurred = false,
  isRestricted = false,
  restrictionMessage = 'Private Photo',
  placeholderIcon = 'camera',
  onRetry,
  containerStyle,
  style,
  resizeMode = 'cover',
  accessibilityLabel = 'Image',
  testID,
  ...rest
}) => {
  const { colors, radii } = useTheme();
  const effectiveSource = source || (uri ? { uri } : undefined);
  const [isLoading, setIsLoading] = useState(Boolean(effectiveSource));
  const [hasError, setHasError] = useState(false);

  const getRatioStyle = (): ViewStyle => {
    if (typeof aspectRatio === 'number') {
      return { aspectRatio };
    }
    switch (aspectRatio) {
      case 'square':
        return { aspectRatio: 1 };
      case 'landscape':
        return { aspectRatio: 16 / 9 };
      case 'thumbnail':
        return { width: 64, height: 64 };
      case 'fullBleed':
        return { width: '100%', height: '100%' };
      case 'portrait':
      default:
        return { aspectRatio: 3 / 4 };
    }
  };

  const resolvedBorderRadius =
    typeof rounded === 'number'
      ? rounded
      : rounded
        ? aspectRatio === 'thumbnail'
          ? radii.radiusMD
          : radii.radiusLG
        : 0;

  return (
    <View
      style={[
        styles.container,
        getRatioStyle(),
        {
          borderRadius: resolvedBorderRadius,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        containerStyle,
      ]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {effectiveSource && !hasError ? (
        <RNImage
          source={effectiveSource}
          style={[
            styles.image,
            { borderRadius: resolvedBorderRadius },
            isBlurred && styles.blurred,
            style,
          ]}
          resizeMode={resizeMode}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          blurRadius={isBlurred ? 24 : 0}
          {...rest}
        />
      ) : (
        <View style={styles.fallbackContainer}>
          <Icon name={placeholderIcon} size="md" color={colors.textTertiary} />
        </View>
      )}

      {/* Loading Shimmer / Spinner */}
      {isLoading && (
        <View style={[styles.overlay, { backgroundColor: colors.surfaceMuted }]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      {/* Restricted State */}
      {isRestricted && (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Icon name="lock" size="sm" color="#FFFFFF" />
          <Text variant="caption" weight="medium" style={{ color: '#FFFFFF', marginTop: 4 }}>
            {restrictionMessage}
          </Text>
        </View>
      )}

      {/* Error Fallback with Retry */}
      {hasError && (
        <View style={[styles.overlay, { backgroundColor: colors.surfaceMuted }]}>
          <Icon name="warning" size="sm" color={colors.error} />
          <Text variant="caption" style={{ color: colors.error, marginTop: 4 }}>
            Failed to load
          </Text>
          {onRetry && (
            <TouchableOpacity
              onPress={() => {
                setHasError(false);
                setIsLoading(true);
                onRetry();
              }}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry loading image"
            >
              <Text variant="caption" weight="semibold" style={{ color: colors.accent }}>
                Retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export const ImagePrimitive = ImageView;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blurred: {
    opacity: 0.85,
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
