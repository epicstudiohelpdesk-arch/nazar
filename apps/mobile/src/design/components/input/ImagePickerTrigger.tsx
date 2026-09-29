import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { Badge } from '../../primitives/Badge.js';

export type PhotoUploadStatus =
  | 'empty'
  | 'uploading'
  | 'processing'
  | 'moderation_pending'
  | 'ready'
  | 'rejected'
  | 'error';

export interface ImagePickerTriggerProps {
  readonly uri?: string | null;
  readonly imageUri?: string | null;
  readonly isPrimary?: boolean;
  readonly status?: PhotoUploadStatus;
  readonly onPickPhoto?: () => void;
  readonly onPickImage?: () => void;
  readonly onRemove?: () => void;
  readonly onRemoveImage?: () => void;
  readonly onRetry?: () => void;
  readonly aspectRatio?: number;
  readonly error?: string;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const ImagePickerTrigger: React.FC<ImagePickerTriggerProps> = ({
  uri,
  imageUri,
  isPrimary = false,
  status = 'empty',
  onPickPhoto,
  onPickImage,
  onRemove,
  onRemoveImage,
  onRetry,
  aspectRatio = 3 / 4,
  error,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const effectiveUri = uri ?? imageUri;
  const handlePick = onPickPhoto || onPickImage;
  const handleRemove = onRemove || onRemoveImage;

  const isUploading = status === 'uploading' || status === 'processing';
  const isRejected = status === 'rejected' || status === 'error';
  const isPendingModeration = status === 'moderation_pending';

  return (
    <View
      style={[
        styles.container,
        {
          aspectRatio,
          borderRadius: radii.radiusLG,
          backgroundColor: colors.surfaceMuted,
          borderColor: isRejected ? colors.error : colors.border,
          borderWidth: effectiveUri ? 1 : 2,
          borderStyle: effectiveUri ? 'solid' : 'dashed',
        },
        style,
      ]}
      testID={testID}
    >
      {effectiveUri ? (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: effectiveUri }}
            style={[styles.image, { borderRadius: radii.radiusLG }]}
            resizeMode="cover"
          />

          {/* Primary Photo Badge */}
          {isPrimary && (
            <View style={styles.primaryBadgeWrapper}>
              <Badge label="Primary" variant="accent" size="sm" />
            </View>
          )}

          {/* Moderation / Upload Overlays */}
          {isUploading && (
            <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text variant="caption" style={{ color: '#FFFFFF', marginTop: 4 }}>
                {status === 'processing' ? 'Processing...' : 'Uploading...'}
              </Text>
            </View>
          )}

          {isPendingModeration && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Icon name="shield" size="sm" color={colors.warning} />
              <Text variant="caption" style={{ color: '#FFFFFF', marginTop: 4 }}>
                Under Review
              </Text>
            </View>
          )}

          {isRejected && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(220, 38, 38, 0.75)' }]}>
              <Icon name="warning" size="sm" color="#FFFFFF" />
              <Text variant="caption" style={{ color: '#FFFFFF', marginTop: 4 }}>
                {error || 'Upload failed'}
              </Text>
              {onRetry && (
                <TouchableOpacity
                  onPress={onRetry}
                  style={styles.retryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Retry photo upload"
                >
                  <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                    Retry
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Remove Button */}
          {handleRemove && !isUploading && (
            <TouchableOpacity
              style={[
                styles.removeButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.radiusFull,
                },
              ]}
              onPress={handleRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Icon name="close" size="tiny" color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.emptyTrigger}
          onPress={handlePick}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
        >
          <View
            style={[
              styles.plusCircle,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.radiusFull,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Icon name="plus" size="sm" color={colors.accent} />
          </View>
          <Text
            variant="caption"
            weight="medium"
            style={{ color: colors.textSecondary, marginTop: spacing.xs }}
          >
            Add Photo
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  primaryBadgeWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
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
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  plusCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
