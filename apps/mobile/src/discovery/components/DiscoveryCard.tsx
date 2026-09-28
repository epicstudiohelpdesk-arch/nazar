import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';
import type { DiscoveryItemDto } from '@platform/api-contracts';

const windowWidth =
  typeof Dimensions !== 'undefined' && typeof Dimensions.get === 'function'
    ? (Dimensions.get('window')?.width ?? 375)
    : 375;
const CARD_WIDTH = Math.min(windowWidth - spacing.lg * 2, 420);

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
  const { profile, distanceBucket } = item;
  const primaryPhoto =
    profile.media.find((m) => m.isPrimary) || (profile.media.length > 0 ? profile.media[0] : null);

  return (
    <View style={styles.cardContainer} testID={testID || `discovery-card-${profile.id}`}>
      {/* 1. Media Image / Photo */}
      <View style={styles.photoContainer}>
        {primaryPhoto?.url ? (
          <Image
            source={{ uri: primaryPhoto.url }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel={`${profile.displayName}'s primary photo`}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>{profile.displayName.charAt(0)}</Text>
          </View>
        )}

        {/* Distance Badge Overlay */}
        {distanceBucket ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>{distanceBucket}</Text>
          </View>
        ) : null}
      </View>

      {/* 2. Candidate Basic Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.nameAgeRow}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          <Text style={styles.age}>, {profile.age}</Text>
        </View>

        {profile.city ? (
          <Text style={styles.locationText}>
            📍 {profile.city}
            {profile.countryCode ? `, ${profile.countryCode}` : ''}
          </Text>
        ) : null}

        {profile.occupation || profile.education ? (
          <Text style={styles.occupationText}>💼 {profile.occupation || profile.education}</Text>
        ) : null}

        {/* 3. Bio */}
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* 4. Interests Chips */}
        {profile.interests && profile.interests.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsRow}>
              {profile.interests.map((interest) => (
                <View key={interest.id} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 5. Profile Prompts */}
        {profile.prompts && profile.prompts.length > 0 ? (
          <View style={styles.section}>
            {profile.prompts.map((prompt) => (
              <View key={prompt.id} style={styles.promptCard}>
                <Text style={styles.promptQuestion}>{prompt.prompt}</Text>
                <Text style={styles.promptAnswer}>{prompt.answer}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 6. Interaction Actions (PASS / LIKE) */}
      {(onPass || onLike) && (
        <View style={styles.actionsRow}>
          {onPass && (
            <TouchableOpacity
              style={[styles.actionButton, styles.passButton, isSubmitting && styles.disabledButton]}
              onPress={onPass}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Pass on ${profile.displayName}`}
              accessibilityHint="Passes this candidate and advances to next profile"
              testID={`pass-btn-${profile.id}`}
            >
              <Text style={styles.passIcon}>✕</Text>
              <Text style={styles.passText}>Pass</Text>
            </TouchableOpacity>
          )}

          {onLike && (
            <TouchableOpacity
              style={[styles.actionButton, styles.likeButton, isSubmitting && styles.disabledButton]}
              onPress={onLike}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.displayName}`}
              accessibilityHint="Likes this candidate. May create a mutual match."
              testID={`like-btn-${profile.id}`}
            >
              <Text style={styles.likeIcon}>♥</Text>
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
    backgroundColor: colors.neutral[50],
    borderRadius: spacing.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    alignSelf: 'center',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  photoContainer: {
    width: '100%',
    height: 380,
    backgroundColor: colors.neutral[200],
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
  },
  distanceBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  distanceBadgeText: {
    color: colors.neutral[50],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  detailsContainer: {
    padding: spacing.lg,
  },
  nameAgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  displayName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  age: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.neutral[700],
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  occupationText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[800],
    lineHeight: 22,
    marginVertical: spacing.sm,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  interestChip: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  interestText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  promptCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  promptAnswer: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[800],
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  passButton: {
    backgroundColor: colors.neutral[200],
    borderWidth: 1,
    borderColor: colors.neutral[400],
  },
  passIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[700],
  },
  passText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  likeButton: {
    backgroundColor: colors.primary[600],
    borderWidth: 1,
    borderColor: colors.primary[700],
  },
  likeIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[50],
  },
  likeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.neutral[50],
  },
  disabledButton: {
    opacity: 0.5,
  },
});
