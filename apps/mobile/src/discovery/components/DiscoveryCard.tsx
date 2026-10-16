import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import type { DiscoveryItemDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Icon } from '../../design/primitives/Icon.js';
import { haptics } from '../../design/haptics/index.js';

const windowWidth =
  typeof Dimensions !== 'undefined' && typeof Dimensions.get === 'function'
    ? (Dimensions.get('window')?.width ?? 375)
    : 375;
const CARD_WIDTH = Math.min(windowWidth - 32, 440);

export interface DiscoveryCardProps {
  readonly item: DiscoveryItemDto;
  readonly testID?: string;
  readonly onPass?: () => void;
  readonly onLike?: () => void;
  readonly isSubmitting?: boolean;
}

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  item,
  testID,
  onPass,
  onLike,
  isSubmitting = false,
}) => {
  const { colors, spacing, radii } = useTheme();
  const { profile, distanceBucket } = item;
  const primaryPhoto =
    profile.media.find((m) => m.isPrimary) || (profile.media.length > 0 ? profile.media[0] : null);

  const handlePass = () => {
    haptics.selection();
    onPass?.();
  };

  const handleLike = () => {
    haptics.selection();
    onLike?.();
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.radiusXL,
        },
      ]}
      testID={testID || `discovery-card-${profile.id}`}
    >
      {/* 1. Media Image / Photo */}
      <View style={[styles.photoContainer, { backgroundColor: colors.surfaceMuted }]}>
        {primaryPhoto?.url ? (
          <Image
            source={{ uri: primaryPhoto.url }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel={`${profile.displayName}'s primary photo`}
          />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.photoPlaceholderText, { color: colors.accent }]}>
              {profile.displayName.charAt(0)}
            </Text>
          </View>
        )}

        {/* Distance Badge Overlay */}
        {distanceBucket ? (
          <View style={styles.distanceBadge}>
            <Icon name="compass" size="tiny" color="#FFFFFF" />
            <Text style={styles.distanceBadgeText}>{distanceBucket}</Text>
          </View>
        ) : null}
      </View>

      {/* 2. Candidate Basic Details */}
      <View style={[styles.detailsContainer, { padding: spacing.lg }]}>
        <View style={styles.nameAgeRow}>
          <Text style={[styles.displayName, { color: colors.textPrimary }]}>
            {profile.displayName}
          </Text>
          <Text style={[styles.age, { color: colors.textSecondary }]}>, {profile.age}</Text>
        </View>

        {profile.city ? (
          <View style={styles.metaRow}>
            <Icon name="location" size="sm" color={colors.textSecondary} />
            <Text style={[styles.locationText, { color: colors.textSecondary }]}>
              {profile.city}
              {profile.countryCode ? `, ${profile.countryCode}` : ''}
            </Text>
          </View>
        ) : null}

        {profile.occupation || profile.education ? (
          <View style={styles.metaRow}>
            <Icon name="briefcase" size="sm" color={colors.textSecondary} />
            <Text style={[styles.occupationText, { color: colors.textSecondary }]}>
              {profile.occupation || profile.education}
            </Text>
          </View>
        ) : null}

        {/* 3. Bio */}
        {profile.bio ? (
          <Text style={[styles.bio, { color: colors.textPrimary }]}>{profile.bio}</Text>
        ) : null}

        {/* 4. Interests Chips */}
        {profile.interests && profile.interests.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Interests</Text>
            <View style={styles.interestsRow}>
              {profile.interests.map((interest) => (
                <View
                  key={interest.id}
                  style={[
                    styles.interestChip,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      borderRadius: radii.radiusFull,
                    },
                  ]}
                >
                  <Text style={[styles.interestText, { color: colors.textPrimary }]}>
                    {interest.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 5. Profile Prompts */}
        {profile.prompts && profile.prompts.length > 0 ? (
          <View style={styles.section}>
            {profile.prompts.map((prompt) => (
              <View
                key={prompt.id}
                style={[
                  styles.promptCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: radii.radiusMD,
                  },
                ]}
              >
                <Text style={[styles.promptQuestion, { color: colors.accent }]}>
                  {prompt.prompt}
                </Text>
                <Text style={[styles.promptAnswer, { color: colors.textPrimary }]}>
                  {prompt.answer}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 6. Interaction Actions (PASS / LIKE) */}
      {(onPass || onLike) && (
        <View
          style={[
            styles.actionsRow,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {onPass && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.passButton,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
                isSubmitting && styles.disabledButton,
              ]}
              onPress={handlePass}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Pass on ${profile.displayName}`}
              accessibilityHint="Passes this candidate and advances to next profile"
              testID={`pass-btn-${profile.id}`}
            >
              <Icon name="close" size="sm" color={colors.textPrimary} />
              <Text style={[styles.passText, { color: colors.textPrimary }]}>Pass</Text>
            </TouchableOpacity>
          )}

          {onLike && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.likeButton,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                },
                isSubmitting && styles.disabledButton,
              ]}
              onPress={handleLike}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.displayName}`}
              accessibilityHint="Likes this candidate. May create a mutual match."
              testID={`like-btn-${profile.id}`}
            >
              <Icon name="heart" size="sm" color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.likeText}>Like</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    marginBottom: 24,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  photoContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
  },
  distanceBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    padding: 16,
  },
  nameAgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
  },
  age: {
    fontSize: 20,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
  },
  occupationText: {
    fontSize: 14,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 6,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '500',
  },
  promptCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  promptQuestion: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  promptAnswer: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  passButton: {
    borderWidth: 1,
  },
  passText: {
    fontSize: 14,
    fontWeight: '600',
  },
  likeButton: {
    borderWidth: 1,
  },
  likeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
