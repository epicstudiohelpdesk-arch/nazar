import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { DiscoveryItemDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Icon } from '../../design/primitives/Icon.js';
import { haptics } from '../../design/haptics/index.js';

const windowWidth =
  typeof Dimensions !== 'undefined' && typeof Dimensions.get === 'function'
    ? (Dimensions.get('window')?.width ?? 375)
    : 375;
const CARD_WIDTH = Math.min(windowWidth - 28, 420);

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
  const { colors, isDark } = useTheme();
  const { profile, distanceBucket } = item;
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const mediaList =
    profile.media && profile.media.length > 0 ? profile.media.map((m) => m.url) : [];

  const currentPhoto = mediaList[activePhotoIdx] || mediaList[0] || null;
  const featuredPrompt = profile.prompts && profile.prompts.length > 0 ? profile.prompts[0] : null;

  const handleNextPhoto = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.();
    if (mediaList.length > 1) {
      haptics.selection();
      setActivePhotoIdx((prev) => (prev + 1) % mediaList.length);
    }
  };

  const handlePrevPhoto = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.();
    if (mediaList.length > 1) {
      haptics.selection();
      setActivePhotoIdx((prev) => (prev - 1 + mediaList.length) % mediaList.length);
    }
  };

  const handlePass = () => {
    haptics.selection();
    onPass?.();
  };

  const handleLike = () => {
    haptics.selection();
    onLike?.();
  };

  // Build compact lifestyle badges with contextual emojis
  const lifestylePills: { id: string; emoji: string; text: string }[] = [];
  if (profile.education) {
    lifestylePills.push({ id: 'edu', emoji: '🎓', text: profile.education });
  }
  if (profile.occupation) {
    lifestylePills.push({ id: 'occ', emoji: '💼', text: profile.occupation });
  }
  if (profile.interests && profile.interests.length > 0) {
    profile.interests.slice(0, 5).forEach((interest, idx) => {
      const lower = interest.name.toLowerCase();
      let emoji = '✨';
      if (lower.includes('coffee') || lower.includes('drink') || lower.includes('wine'))
        emoji = '☕';
      else if (lower.includes('design') || lower.includes('art')) emoji = '🎨';
      else if (lower.includes('architecture')) emoji = '🏛️';
      else if (lower.includes('book') || lower.includes('read')) emoji = '📚';
      else if (lower.includes('trek') || lower.includes('outdoor')) emoji = '🏔️';
      else if (lower.includes('tech') || lower.includes('code')) emoji = '💻';
      else if (lower.includes('music') || lower.includes('rock')) emoji = '🎵';
      else if (lower.includes('dance')) emoji = '💃';
      else if (lower.includes('science')) emoji = '🔬';
      else if (lower.includes('game')) emoji = '🎮';
      else if (lower.includes('anime')) emoji = '🇯🇵';
      else if (lower.includes('yoga')) emoji = '🧘';
      else if (lower.includes('food') || lower.includes('ramen')) emoji = '🍜';
      lifestylePills.push({ id: `int-${idx}`, emoji, text: interest.name });
    });
  }
  if (lifestylePills.length < 3) {
    lifestylePills.push({ id: 'ls-1', emoji: '👄', text: 'Better in person' });
    lifestylePills.push({ id: 'ls-2', emoji: '💬', text: 'Time together' });
    lifestylePills.push({ id: 'ls-3', emoji: '🌙', text: 'Aries' });
  }

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
      testID={testID || `discovery-card-${profile.id}`}
    >
      {/* 1. Media Image / Photo - Full Bleed to Top */}
      <View style={[styles.photoContainer, { backgroundColor: colors.surfaceMuted }]}>
        {currentPhoto ? (
          <Image
            source={{ uri: currentPhoto }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel={`${profile.displayName}'s photo`}
          />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.photoPlaceholderText, { color: colors.accent }]}>
              {profile.displayName.charAt(0)}
            </Text>
          </View>
        )}

        {/* Tap areas for photo cycling */}
        {mediaList.length > 1 && (
          <View style={styles.tapAreasOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.tapAreaLeft}
              onPress={handlePrevPhoto}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
            />
            <TouchableOpacity
              style={styles.tapAreaRight}
              onPress={handleNextPhoto}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel="Next photo"
            />
          </View>
        )}

        {/* Top Protective Vignette Fade */}
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0.65)',
            'rgba(0, 0, 0, 0.32)',
            'rgba(0, 0, 0, 0.08)',
            'transparent',
          ]}
          locations={[0, 0.38, 0.7, 1]}
          style={styles.topVignette}
          pointerEvents="none"
        />

        {/* Bottom Multi-Stop Velvety Fade Scrim */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(12, 10, 16, 0.08)',
            'rgba(12, 10, 16, 0.48)',
            'rgba(12, 10, 16, 0.84)',
            'rgba(12, 10, 16, 0.98)',
          ]}
          locations={[0, 0.22, 0.5, 0.78, 1]}
          style={styles.discoveryScrim}
          pointerEvents="none"
        />

        {/* Top Story Progress Bars */}
        {mediaList.length > 1 && (
          <View style={styles.storyProgressRow} pointerEvents="none">
            {mediaList.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.storyProgressBar,
                  {
                    backgroundColor:
                      idx === activePhotoIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.38)',
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Top Badges Row */}
        <View style={styles.topBadgesRow} pointerEvents="box-none">
          {/* Left: Compatibility / Match Score Pill */}
          <LinearGradient
            colors={['#FF2E48', '#DC0C24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.matchScoreGradientPill}
          >
            <Icon name="sparkles" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.matchScoreText}>94% MATCH</Text>
          </LinearGradient>

          {/* Right: Distance Badge & Counter */}
          <View style={styles.topRightPills}>
            {distanceBucket ? (
              <View style={styles.frostedPill}>
                <Icon name="compass" size={11} color="#FFFFFF" style={{ marginRight: 3.5 }} />
                <Text style={styles.frostedPillText}>{distanceBucket}</Text>
              </View>
            ) : null}
            {mediaList.length > 1 && (
              <View style={styles.frostedPill}>
                <Icon name="camera" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.frostedPillText}>
                  {activePhotoIdx + 1}/{mediaList.length}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Details Vignette - Compact & Professional */}
        <View style={styles.detailsOverlay} pointerEvents="box-none">
          {/* 1. Name & Age Row with Verification & Active status */}
          <View style={styles.nameHeaderRow}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.displayName}
              </Text>
              <Text style={styles.age}>, {profile.age}</Text>
              <View style={styles.verifiedBadge}>
                <Icon name="check" size={10} color="#FFFFFF" strokeWidth={3.4} />
              </View>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Active</Text>
              </View>
            </View>
          </View>

          {/* 2. Location & Occupation Meta */}
          <View style={styles.metaRow}>
            {profile.city ? (
              <View style={styles.metaItem}>
                <Icon
                  name="location"
                  size={11.5}
                  color="rgba(255, 255, 255, 0.85)"
                  style={{ marginRight: 3.5 }}
                />
                <Text style={styles.metaText} numberOfLines={1}>
                  {profile.city}
                  {profile.countryCode ? `, ${profile.countryCode}` : ''}
                </Text>
              </View>
            ) : null}
            {profile.city && (profile.occupation || profile.education) ? (
              <Text style={styles.metaDot}>•</Text>
            ) : null}
            {profile.occupation || profile.education ? (
              <View style={styles.metaItem}>
                <Icon
                  name="briefcase"
                  size={11.5}
                  color="rgba(255, 255, 255, 0.85)"
                  style={{ marginRight: 3.5 }}
                />
                <Text style={styles.metaText} numberOfLines={1}>
                  {profile.occupation || profile.education}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 3. Matched Preferences Subtitle */}
          <View style={styles.preferenceMatchRow}>
            <Icon name="sparkles" size={11} color="#FF4D6D" style={{ marginRight: 4 }} />
            <Text style={styles.preferenceMatchText}>
              Matched{' '}
              {profile.interests?.length
                ? `${Math.min(profile.interests.length, 5)}+ Preferences`
                : 'Key Preferences'}
            </Text>
          </View>

          {/* 4. Compact Lifestyle & Interest Chips */}
          <View style={styles.lifestyleChipsWrap}>
            {lifestylePills.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.tinderLifestyleChip}>
                <Text style={styles.lifestyleChipEmoji}>{item.emoji}</Text>
                <Text style={styles.tinderLifestyleChipText} numberOfLines={1}>
                  {item.text}
                </Text>
              </View>
            ))}
            {lifestylePills.length > 4 && (
              <View style={styles.moreChipsBadge}>
                <Text style={styles.moreChipsText}>+{lifestylePills.length - 4}</Text>
              </View>
            )}
          </View>

          {/* 5. Prompt or Bio Quotation */}
          {featuredPrompt ? (
            <View style={styles.promptTeaserBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promptTeaserQuestion} numberOfLines={1}>
                  {featuredPrompt.prompt}
                </Text>
                <Text style={styles.promptTeaserAnswer} numberOfLines={2}>
                  "{featuredPrompt.answer}"
                </Text>
              </View>
            </View>
          ) : profile.bio ? (
            <View style={styles.bioTeaserBox}>
              <Text style={styles.bioTeaserText} numberOfLines={2}>
                "{profile.bio}"
              </Text>
            </View>
          ) : null}

          {/* 6. Integrated Floating Action Buttons (Pass / Like) */}
          {(onPass || onLike) && (
            <View style={styles.actionsRow}>
              {onPass && (
                <TouchableOpacity
                  style={[
                    styles.actionBtnCircle,
                    styles.passCircle,
                    isSubmitting && styles.disabledButton,
                  ]}
                  onPress={handlePass}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Pass on ${profile.displayName}`}
                  testID={`pass-btn-${profile.id}`}
                >
                  <Icon name="close" size={24} color="#FB7185" strokeWidth={2.8} />
                </TouchableOpacity>
              )}

              {onLike && (
                <TouchableOpacity
                  style={[
                    styles.actionBtnCircle,
                    styles.likeCircle,
                    isSubmitting && styles.disabledButton,
                  ]}
                  onPress={handleLike}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Like ${profile.displayName}`}
                  testID={`like-btn-${profile.id}`}
                >
                  <Icon name="heart" size={26} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: 580,
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
  },
  photoContainer: {
    width: '100%',
    height: '100%',
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
  tapAreasOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 15,
  },
  tapAreaLeft: {
    width: '40%',
    height: '75%',
  },
  tapAreaRight: {
    width: '40%',
    height: '75%',
    marginLeft: 'auto',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    zIndex: 3,
  },
  discoveryScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '66%',
    zIndex: 4,
  },
  storyProgressRow: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 4,
    zIndex: 6,
  },
  storyProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  topBadgesRow: {
    position: 'absolute',
    top: 20,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 6,
  },
  matchScoreGradientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#DC0C24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  matchScoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frostedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 10, 16, 0.60)',
    paddingHorizontal: 9.5,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  frostedPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  age: {
    fontSize: 23,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.90)',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  verifiedBadge: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#3B82F6',
    marginLeft: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 3,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.20)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    marginLeft: 7,
  },
  onlineDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 3.5,
  },
  onlineText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.1,
  },
  metaDot: {
    color: 'rgba(255, 255, 255, 0.50)',
    marginHorizontal: 5,
    fontSize: 11,
  },
  preferenceMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  preferenceMatchText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.2,
  },
  lifestyleChipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 5,
  },
  tinderLifestyleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 26, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
  },
  lifestyleChipEmoji: {
    fontSize: 11.5,
    marginRight: 4,
  },
  tinderLifestyleChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  moreChipsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 4.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreChipsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  promptTeaserBox: {
    backgroundColor: 'rgba(22, 18, 28, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  promptTeaserQuestion: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FF4D6D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  promptTeaserAnswer: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  bioTeaserBox: {
    backgroundColor: 'rgba(22, 18, 28, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  bioTeaserText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.90)',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 10,
    paddingBottom: 4,
  },
  actionBtnCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  passCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(24, 20, 28, 0.85)',
    borderColor: 'rgba(251, 113, 133, 0.40)',
  },
  likeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DC0C24',
    borderColor: '#FF2E48',
    shadowColor: '#DC0C24',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
