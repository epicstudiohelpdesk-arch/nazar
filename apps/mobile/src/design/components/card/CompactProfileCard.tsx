import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';
import type { ProfileCardData } from './ProfileCard.js';

export interface CompactProfileCardProps {
  readonly profile: ProfileCardData;
  readonly onPress?: () => void;
  readonly onAction?: () => void;
  readonly actionIcon?: string;
  readonly actionLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const CompactProfileCard: React.FC<CompactProfileCardProps> = ({
  profile,
  onPress,
  onAction,
  actionIcon = 'heart',
  actionLabel = 'Connect',
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const effectiveImageUri = profile.imageUrl || profile.images?.[0];
  const effectiveVerified = profile.isVerified ?? profile.verified;
  const effectiveCity = profile.city || profile.location;

  return (
    <SurfaceCard
      p="sm"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `compact-profile-${profile.id}`}
    >
      <View style={styles.contentRow}>
        {/* Photo Thumbnail */}
        <View
          style={[
            styles.thumbnailWrapper,
            {
              borderRadius: radii.radiusMD,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          {effectiveImageUri ? (
            <Image
              source={{ uri: effectiveImageUri }}
              style={[styles.thumbnail, { borderRadius: radii.radiusMD }]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text variant="title" weight="bold" style={{ color: colors.accent }}>
                {profile.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>

        {/* Text Info */}
        <View style={[styles.infoWrapper, { marginLeft: spacing.md }]}>
          <View style={styles.titleRow}>
            <Text variant="title" weight="semibold" style={{ color: colors.textPrimary }}>
              {profile.name}, {profile.age}
            </Text>
            {effectiveVerified && (
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: colors.info, marginLeft: spacing.xs },
                ]}
              >
                <Icon name="check" size="tiny" color="#FFFFFF" strokeWidth={2.5} />
              </View>
            )}
          </View>

          {effectiveCity && (
            <View style={styles.metaRow}>
              <Icon
                name="location"
                size="tiny"
                color={colors.textTertiary}
                style={{ marginRight: 4 }}
              />
              <Text variant="caption" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {effectiveCity}
              </Text>
            </View>
          )}

          {profile.contextualInfo && (
            <Text
              variant="caption"
              style={{ color: colors.accent, marginTop: 2 }}
              numberOfLines={1}
            >
              {profile.contextualInfo}
            </Text>
          )}
        </View>

        {/* Action Slot or Chevron */}
        {onAction ? (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
                borderRadius: radii.radiusFull,
              },
            ]}
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} with ${profile.name}`}
          >
            <Icon name={(actionIcon as any) || 'heart'} size="sm" color={colors.accent} />
          </TouchableOpacity>
        ) : onPress ? (
          <Icon name="chevron" direction="right" size="sm" color={colors.textTertiary} />
        ) : null}
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginVertical: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 10,
  },
});
