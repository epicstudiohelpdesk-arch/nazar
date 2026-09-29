import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Badge } from '../../primitives/Badge.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export type ProfileCardContext =
  | 'discovery'
  | 'likes'
  | 'matches'
  | 'search'
  | 'community'
  | 'event'
  | 'profilePreview';

export interface ProfileCardData {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly city?: string;
  readonly country?: string;
  readonly occupation?: string;
  readonly education?: string;
  readonly bio?: string;
  readonly imageUrl?: string | null;
  readonly imageCount?: number;
  readonly isVerified?: boolean;
  readonly contextualInfo?: string; // e.g. "Within 5 km", "Matched 2d ago", "Attending Mumbai Mixer"
  readonly interests?: readonly string[];
  readonly prompts?: readonly {
    readonly question: string;
    readonly answer: string;
  }[];
}

export interface ProfileCardProps {
  readonly profile: ProfileCardData;
  readonly context?: ProfileCardContext;
  readonly onPass?: () => void;
  readonly onLike?: () => void;
  readonly onSuperLike?: () => void;
  readonly onMessage?: () => void;
  readonly onPress?: () => void;
  readonly isSubmitting?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  context = 'discovery',
  onPass,
  onLike,
  onSuperLike,
  onMessage,
  onPress,
  isSubmitting = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const isDiscovery = context === 'discovery';
  const isCompact = context === 'matches' || context === 'search' || context === 'community';

  return (
    <SurfaceCard
      p="none"
      radius="radiusXL"
      elevationLevel={isDiscovery ? 'shadowMD' : 'shadowSM'}
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `profile-card-${profile.id}`}
    >
      {/* Media Header */}
      <View
        style={[
          styles.imageContainer,
          {
            height: isCompact ? 220 : 380,
            backgroundColor: colors.surfaceMuted,
          },
        ]}
      >
        {profile.imageUrl ? (
          <Image
            source={{ uri: profile.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={`${profile.name}'s profile photo`}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text variant="display" weight="bold" style={{ color: colors.accent }}>
              {profile.name.charAt(0)}
            </Text>
          </View>
        )}

        {/* Gradient Scrim Overlay at Bottom of Photo */}
        <View style={[styles.scrimOverlay, { backgroundColor: colors.scrim }]} />

        {/* Top Badges (Image Count & Contextual Info) */}
        <View style={styles.topBadgesRow}>
          {profile.contextualInfo ? (
            <Badge label={profile.contextualInfo} variant="neutral" size="sm" />
          ) : <View />}

          {profile.imageCount && profile.imageCount > 1 ? (
            <View style={[styles.imageCountBadge, { borderRadius: radii.radiusFull }]}>
              <Icon name="camera" size="tiny" color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                {profile.imageCount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Overlay Details (Name, Age, Verified, Location) */}
        <View style={styles.imageDetailsOverlay}>
          <View style={styles.nameRow}>
            <Heading level={isCompact ? 'h3' : 'h2'} style={{ color: '#FFFFFF' }}>
              {profile.name}, {profile.age}
            </Heading>
            {profile.isVerified && (
              <View style={[styles.verifiedDot, { backgroundColor: colors.info }]}>
                <Icon name="check" size="tiny" color="#FFFFFF" strokeWidth={2.5} />
              </View>
            )}
          </View>

          {profile.city && (
            <View style={styles.locationRow}>
              <Icon name="location" size="tiny" color="#E7E2DA" style={{ marginRight: 4 }} />
              <Text variant="bodySmall" style={{ color: '#E7E2DA' }}>
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </Text>
            </View>
          )}

          {profile.occupation && (
            <Text variant="caption" style={{ color: '#D1C9BE', marginTop: 2 }}>
              {profile.occupation}
              {profile.education ? ` · ${profile.education}` : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Body Details (Bio, Interests, Prompts) */}
      {!isCompact && (
        <View style={{ padding: spacing.lg }}>
          {profile.bio ? (
            <Text variant="body" style={{ color: colors.textPrimary, marginBottom: spacing.md }}>
              {profile.bio}
            </Text>
          ) : null}

          {/* Interests Chips */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text variant="label" style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>
                Interests
              </Text>
              <View style={styles.interestsWrap}>
                {profile.interests.map((interest) => (
                  <View
                    key={interest}
                    style={[
                      styles.interestChip,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        borderRadius: radii.radiusFull,
                      },
                    ]}
                  >
                    <Text variant="caption" weight="medium" style={{ color: colors.textPrimary }}>
                      {interest}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Profile Prompts */}
          {profile.prompts &&
            profile.prompts.map((prompt, idx) => (
              <View
                key={idx}
                style={[
                  styles.promptCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radii.radiusMD,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  weight="bold"
                  style={{ color: colors.accent, marginBottom: spacing.xxs }}
                >
                  {prompt.question}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textPrimary, fontStyle: 'italic' }}>
                  "{prompt.answer}"
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Actions Row */}
      {(onPass || onLike || onSuperLike || onMessage) && (
        <View
          style={[
            styles.actionsRow,
            {
              borderTopColor: colors.border,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          {onPass && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.passBtn,
                { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
              ]}
              onPress={onPass}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Pass on ${profile.name}`}
            >
              <Icon name="close" size="md" color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {onSuperLike && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.superBtn,
                { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
              ]}
              onPress={onSuperLike}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Super like ${profile.name}`}
            >
              <Icon name="sparkles" size="md" color="#D97706" />
            </TouchableOpacity>
          )}

          {onMessage && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.messageBtn,
                { borderColor: colors.info, backgroundColor: colors.infoSoft },
              ]}
              onPress={onMessage}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Message ${profile.name}`}
            >
              <Icon name="message" size="md" color={colors.info} />
            </TouchableOpacity>
          )}

          {onLike && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.likeBtn,
                { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
              onPress={onLike}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.name}`}
            >
              <Icon name="heart" size="md" color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrimOverlay: {
    ...StyleSheet.absoluteFill,
    top: '40%',
  },
  topBadgesRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  imageDetailsOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  promptCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#D84315',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  passBtn: {},
  superBtn: {},
  messageBtn: {},
  likeBtn: {},
});
