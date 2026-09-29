import React, { useState } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export type MediaViewAspectRatio = 'square' | 'portrait' | 'landscape' | 'fullBleed' | 'thumbnail';

export interface MediaViewProps {
  readonly uri?: string | null;
  readonly aspectRatio?: MediaViewAspectRatio;
  readonly rounded?: boolean;
  readonly isBlurred?: boolean;
  readonly isRestricted?: boolean;
  readonly restrictionMessage?: string;
  readonly accessibilityLabel?: string;
  readonly onRetry?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const MediaView: React.FC<MediaViewProps> = ({
  uri,
  aspectRatio = 'portrait',
  rounded = true,
  isBlurred = false,
  isRestricted = false,
  restrictionMessage = 'Private Photo',
  accessibilityLabel = 'Media image',
  onRetry,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();
  const [isLoading, setIsLoading] = useState(Boolean(uri));
  const [hasError, setHasError] = useState(false);

  const getRatioStyle = (): ViewStyle => {
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

  const borderRadius = rounded
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
          borderRadius,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {uri && !hasError ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { borderRadius },
            isBlurred && styles.blurred,
          ]}
          resizeMode="cover"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          blurRadius={isBlurred ? 24 : 0}
        />
      ) : (
        <View style={styles.fallbackContainer}>
          <Icon name="camera" size="md" color={colors.textTertiary} />
        </View>
      )}

      {/* Loading Skeleton / Spinner State */}
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

      {/* Error Fallback */}
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
