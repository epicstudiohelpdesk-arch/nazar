import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';
import { useResponsiveLayout } from '../../responsive/index.js';
import { haptics } from '../../haptics/index.js';

export type ProfileCardContext =
  'discovery' | 'likes' | 'matches' | 'search' | 'community' | 'event' | 'profilePreview';

export interface ProfileCardData {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly city?: string;
  readonly country?: string;
  readonly location?: string;
  readonly occupation?: string;
  readonly education?: string;
  readonly bio?: string;
  readonly imageUrl?: string | null;
  readonly images?: readonly string[];
  readonly imageCount?: number;
  readonly isVerified?: boolean;
  readonly verified?: boolean;
  readonly contextualInfo?: string; // e.g. "Within 5 km", "Matched 2d ago", "Attending Mumbai Mixer"
  readonly interests?: readonly string[];
  readonly matchPercentage?: number;
  readonly isOnline?: boolean;
  readonly prompts?: readonly {
    readonly question: string;
    readonly answer: string;
  }[];
  readonly audioPrompts?: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly audioUrl: string;
    readonly durationSeconds: number;
    readonly waveformPeaks?: readonly number[];
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
  readonly onFollow?: () => void;
  readonly onInlineLike?: (attachment: {
    readonly type: 'MEDIA' | 'PROMPT';
    readonly id?: string;
    readonly text?: string;
  }) => void;
  readonly isSubmitting?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

/**
 * High-fidelity 12-lobed scalloped verified badge matching user specifications:
 * - Light mode: emerald green rosette (#10B981) with white checkmark
 * - Dark mode: pure white rosette (#FFFFFF) with black checkmark
 */
const ScallopedVerifiedBadge: React.FC<{ readonly isDark: boolean; readonly size?: number }> = ({
  isDark,
  size = 22,
}) => {
  const fillColor = isDark ? '#FFFFFF' : '#10B981';
  const checkColor = isDark ? '#0A0A0D' : '#FFFFFF';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 12 2.8 A 2.41 2.41 0 0 1 16.6 4.03 A 2.41 2.41 0 0 1 19.97 7.4 A 2.41 2.41 0 0 1 21.2 12 A 2.41 2.41 0 0 1 19.97 16.6 A 2.41 2.41 0 0 1 16.6 19.97 A 2.41 2.41 0 0 1 12 21.2 A 2.41 2.41 0 0 1 7.4 19.97 A 2.41 2.41 0 0 1 4.03 16.6 A 2.41 2.41 0 0 1 2.8 12 A 2.41 2.41 0 0 1 4.03 7.4 A 2.41 2.41 0 0 1 7.4 4.03 A 2.41 2.41 0 0 1 12 2.8 Z"
        fill={fillColor}
      />
      <Path
        d="M 8.5 12.2 L 10.8 14.5 L 15.8 9.5"
        stroke={checkColor}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  context = 'discovery',
  onPass,
  onLike,
  onSuperLike,
  onMessage,
  onPress,
  onFollow: _onFollow,
  onInlineLike,
  isSubmitting = false,
  style,
  testID,
}) => {
  const { colors, spacing, isDark } = useTheme();
  const { isSmallScreen, isLargeScreen } = useResponsiveLayout();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const isDiscovery = context === 'discovery';
  const isCompact = context === 'matches' || context === 'search' || context === 'community';

  const mediaList =
    profile.images && profile.images.length > 0
      ? profile.images
      : profile.imageUrl
        ? [profile.imageUrl]
        : [];

  const currentPhoto = mediaList[activePhotoIdx] || profile.imageUrl || null;
  const effectiveVerified = profile.isVerified ?? profile.verified;
  const effectiveCity = profile.city || profile.location;

  const dynamicImageHeight = isCompact ? 220 : isSmallScreen ? 350 : isLargeScreen ? 450 : 400;

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

  const featuredPrompt = profile.prompts && profile.prompts.length > 0 ? profile.prompts[0] : null;
  const effectiveDistance = profile.contextualInfo
    ? profile.contextualInfo.replace(/🎟️|✈️/g, '').trim()
    : null;

  const lifestylePills: { id: string; emoji: string; text: string }[] = [];
  if (profile.education) {
    lifestylePills.push({ id: 'edu', emoji: '🎓', text: profile.education });
  }
  if (profile.occupation) {
    lifestylePills.push({ id: 'occ', emoji: '💼', text: profile.occupation });
  }
  if (profile.interests && profile.interests.length > 0) {
    profile.interests.slice(0, 4).forEach((interest, idx) => {
      const lower = interest.toLowerCase();
      let emoji = '✨';
      if (lower.includes('coffee') || lower.includes('drink') || lower.includes('wine'))
        emoji = '🍷';
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
      lifestylePills.push({ id: `int-${idx}`, emoji, text: interest });
    });
  }
  if (lifestylePills.length < 3) {
    lifestylePills.push({ id: 'ls-1', emoji: '👄', text: 'Better in person' });
    lifestylePills.push({ id: 'ls-2', emoji: '💬', text: 'Time together' });
    lifestylePills.push({ id: 'ls-3', emoji: '🌙', text: 'Aries' });
  }

  if (isDiscovery) {
    return (
      <View
        style={[
          styles.discoveryCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
          },
          style,
        ]}
        testID={testID || `profile-card-${profile.id}`}
      >
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={onPress}
          style={styles.discoveryTouchable}
          accessibilityRole="button"
          accessibilityLabel={`View full profile for ${profile.name}`}
        >
          {/* Background Image / Media - Full bleed to top */}
          <View style={[styles.discoveryImageWrapper, { backgroundColor: colors.surfaceMuted }]}>
            {currentPhoto ? (
              <Image
                source={{ uri: currentPhoto }}
                style={styles.discoveryImage}
                resizeMode="cover"
                accessibilityLabel={`${profile.name}'s profile photo ${activePhotoIdx + 1} of ${mediaList.length || 1}`}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text variant="display" weight="bold" style={{ color: colors.accent }}>
                  {profile.name.charAt(0)}
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

            {/* Top Protective Vignette Fade (Amore & Modern UI) */}
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

            {/* Bottom Multi-Stop Velvety Fade Scrim (Signature Faded Design) */}
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
              {/* Left Match Score Pill with vivid ruby gradient */}
              <LinearGradient
                colors={['#FF2E48', '#DC0C24']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.matchScoreGradientPill}
              >
                <Icon name="sparkles" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.matchScoreText}>{profile.matchPercentage ?? 94}% MATCH</Text>
              </LinearGradient>

              {/* Right Location & Counter Badges */}
              <View style={styles.topRightPills}>
                {effectiveDistance && (
                  <View style={styles.frostedPill}>
                    <Icon name="compass" size={11} color="#FFFFFF" style={{ marginRight: 3.5 }} />
                    <Text style={styles.frostedPillText}>{effectiveDistance}</Text>
                  </View>
                )}
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

            {/* Bottom Content Vignette - Medina Amandel & Tinder Inspiration */}
            <View style={styles.discoveryDetailsOverlay} pointerEvents="box-none">
              {/* 1. Name, Age, Verified & Circular White Info Button */}
              <View style={styles.nameHeaderRow}>
                <View style={styles.nameRow}>
                  <Text style={styles.discoveryNameText} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <Text style={styles.discoveryAgeText}>, {profile.age}</Text>
                  {effectiveVerified && (
                    <View style={styles.discoveryVerifiedBadge}>
                      <ScallopedVerifiedBadge isDark={true} size={19} />
                    </View>
                  )}
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Active</Text>
                  </View>
                </View>

                {/* Circular White Info / Detail Button */}
                <TouchableOpacity
                  style={styles.tinderInfoBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    haptics.selection();
                    onPress?.();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`View full profile for ${profile.name}`}
                  testID="discovery-info-btn"
                >
                  <Icon name="arrowUpRight" size={16} color="#111113" strokeWidth={2.8} />
                </TouchableOpacity>
              </View>

              {/* 2. Professional Location & Career Subtitle */}
              <View style={styles.metaRow}>
                {effectiveCity ? (
                  <View style={styles.metaItem}>
                    <Icon
                      name="location"
                      size={11.5}
                      color="rgba(255, 255, 255, 0.85)"
                      style={{ marginRight: 3.5 }}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {effectiveCity}
                    </Text>
                  </View>
                ) : null}
                {effectiveCity && (profile.occupation || profile.education) ? (
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

              {/* 3. Compatibility Highlight (Medina Amandel Inspiration) */}
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

              {/* 5. Editorial Prompt or Bio Highlight */}
              {featuredPrompt ? (
                <View style={styles.promptTeaserBox}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.promptTeaserQuestion} numberOfLines={1}>
                      {featuredPrompt.question}
                    </Text>
                    <Text style={styles.promptTeaserAnswer} numberOfLines={2}>
                      "{featuredPrompt.answer}"
                    </Text>
                  </View>
                  {onInlineLike && (
                    <TouchableOpacity
                      style={styles.discoveryInlineHeartBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        haptics.selection();
                        onInlineLike({
                          type: 'PROMPT',
                          id: 'prompt-0',
                          text: featuredPrompt.answer,
                        });
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Like prompt: ${featuredPrompt.question}`}
                    >
                      <Icon name="heart" size={13} color="#DC0C24" fill="#DC0C24" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : profile.bio ? (
                <View style={styles.bioTeaserBox}>
                  <Text style={styles.bioTeaserText} numberOfLines={2}>
                    "{profile.bio}"
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Profile Preview Mode (Pixel-perfect matching luxury preview card design with complete profile contents)
  if (context === 'profilePreview') {
    return (
      <View
        style={[
          styles.previewOuterBezel,
          {
            backgroundColor: isDark ? '#1E1F24' : '#F6F7F9',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            shadowColor: '#000000',
            shadowOpacity: isDark ? 0.45 : 0.09,
          },
          style,
        ]}
        testID={testID || `profile-card-preview-${profile.id}`}
      >
        <View
          style={[
            styles.previewInnerCard,
            {
              backgroundColor: isDark ? '#141519' : '#ECEEF1',
            },
          ]}
        >
          {/* Full-bleed Portrait Photograph */}
          {currentPhoto ? (
            <Image
              source={{ uri: currentPhoto }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityLabel={`${profile.name}'s profile photo`}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text variant="display" weight="bold" style={{ color: colors.accent }}>
                {(profile.name || 'S').charAt(0)}
              </Text>
            </View>
          )}

          {/* Interactive photo cycling touch zones */}
          {mediaList.length > 1 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.previewTapAreaLeft}
                onPress={handlePrevPhoto}
                activeOpacity={1}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              />
              <TouchableOpacity
                style={styles.previewTapAreaRight}
                onPress={handleNextPhoto}
                activeOpacity={1}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              />
            </View>
          )}

          {/* Top Story Indicator Bars when multiple photos */}
          {mediaList.length > 1 && (
            <View style={styles.previewStoryProgressRow} pointerEvents="none">
              {mediaList.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.previewStoryProgressBar,
                    {
                      backgroundColor:
                        idx === activePhotoIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Multi-stop Frosted Glass Bottom Scrim Gradient */}
          <LinearGradient
            colors={
              isDark
                ? [
                    'rgba(18, 19, 24, 0.0)',
                    'rgba(18, 19, 24, 0.38)',
                    'rgba(18, 19, 24, 0.84)',
                    'rgba(18, 19, 24, 0.96)',
                    'rgba(18, 19, 24, 0.99)',
                  ]
                : [
                    'rgba(255, 255, 255, 0.0)',
                    'rgba(255, 255, 255, 0.42)',
                    'rgba(255, 255, 255, 0.86)',
                    'rgba(255, 255, 255, 0.96)',
                    'rgba(255, 255, 255, 0.99)',
                  ]
            }
            locations={[0, 0.22, 0.55, 0.82, 1.0]}
            style={styles.previewGradientScrim}
            pointerEvents="none"
          />

          {/* Bottom Overlay Content */}
          <View style={styles.previewOverlayContent} pointerEvents="box-none">
            {/* 1. Name & Age & Scalloped Rosette Verified Badge */}
            <View style={styles.previewNameRow}>
              <View style={styles.previewNameAndAge}>
                <Text
                  style={[styles.previewNameText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                  numberOfLines={1}
                >
                  {profile.name || 'Sophie Bennett'}
                </Text>
                {profile.age ? (
                  <Text style={[styles.previewAgeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    , {profile.age}
                  </Text>
                ) : null}
              </View>

              {(effectiveVerified ?? true) && (
                <View style={styles.previewBadgeWrapper}>
                  <ScallopedVerifiedBadge isDark={isDark} size={22} />
                </View>
              )}
            </View>

            {/* 2. Professional Location & Career Subtitle */}
            {(effectiveCity || profile.occupation || profile.education) && (
              <View style={styles.previewMetaRow}>
                {effectiveCity && (
                  <View style={styles.previewMetaItem}>
                    <Icon
                      name="location"
                      size={12}
                      color={isDark ? 'rgba(255, 255, 255, 0.70)' : '#64748B'}
                      style={{ marginRight: 3.5 }}
                    />
                    <Text
                      style={[
                        styles.previewMetaText,
                        { color: isDark ? 'rgba(255, 255, 255, 0.85)' : '#475569' },
                      ]}
                      numberOfLines={1}
                    >
                      {effectiveCity}
                    </Text>
                  </View>
                )}

                {effectiveCity && (profile.occupation || profile.education) && (
                  <Text
                    style={[
                      styles.previewMetaDot,
                      { color: isDark ? 'rgba(255, 255, 255, 0.35)' : '#94A3B8' },
                    ]}
                  >
                    •
                  </Text>
                )}

                {(profile.occupation || profile.education) && (
                  <View style={styles.previewMetaItem}>
                    <Icon
                      name={profile.occupation ? 'briefcase' : 'graduationCap'}
                      size={12}
                      color={isDark ? 'rgba(255, 255, 255, 0.70)' : '#64748B'}
                      style={{ marginRight: 3.5 }}
                    />
                    <Text
                      style={[
                        styles.previewMetaText,
                        { color: isDark ? 'rgba(255, 255, 255, 0.85)' : '#475569' },
                      ]}
                      numberOfLines={1}
                    >
                      {profile.occupation || profile.education}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 3. Headline / Bio / Personal Statement */}
            {profile.bio ? (
              <Text
                style={[
                  styles.previewBioText,
                  { color: isDark ? 'rgba(255, 255, 255, 0.90)' : '#334155' },
                ]}
                numberOfLines={3}
              >
                {profile.bio}
              </Text>
            ) : featuredPrompt ? (
              <Text
                style={[
                  styles.previewBioText,
                  { color: isDark ? 'rgba(255, 255, 255, 0.90)' : '#334155', fontStyle: 'italic' },
                ]}
                numberOfLines={3}
              >
                “{featuredPrompt.answer}”
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SurfaceCard
      p="none"
      radius="radiusXL"
      elevationLevel={isDiscovery ? 'shadowMD' : 'shadowSM'}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          backgroundColor: colors.surface,
        },
        style,
      ]}
      testID={testID || `profile-card-${profile.id}`}
    >
      {/* Media Header Container */}
      <View
        style={[
          styles.imageContainer,
          {
            height: dynamicImageHeight,
            backgroundColor: colors.surfaceMuted,
          },
        ]}
      >
        {currentPhoto ? (
          <Image
            source={{ uri: currentPhoto }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={`${profile.name}'s profile photo ${activePhotoIdx + 1} of ${mediaList.length || 1}`}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text variant="display" weight="bold" style={{ color: colors.accent }}>
              {profile.name.charAt(0)}
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

        {/* Seamless Linear Gradient Scrim */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.5, 1]}
          style={styles.scrimOverlay}
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
                      idx === activePhotoIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Top Floating Badges */}
        <View style={styles.topBadgesRow} pointerEvents="box-none">
          {profile.contextualInfo ? (
            <View style={styles.contextualPill}>
              {profile.contextualInfo.includes('🎟️') ? (
                <Icon name="ticket" size={13} color="#FF8A65" style={{ marginRight: 5 }} />
              ) : profile.contextualInfo.includes('✈️') ? (
                <Icon name="plane" size={13} color="#60A5FA" style={{ marginRight: 5 }} />
              ) : (
                <Icon name="location" size={13} color="#E7E2DA" style={{ marginRight: 5 }} />
              )}
              <Text
                variant="caption"
                weight="semibold"
                style={{ color: '#FFFFFF', letterSpacing: 0.2 }}
                numberOfLines={1}
              >
                {profile.contextualInfo.replace(/🎟️|✈️/g, '').trim()}
              </Text>
            </View>
          ) : (
            <View />
          )}

          {mediaList.length > 1 ? (
            <View style={styles.imageCountBadge}>
              <Icon name="camera" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF', fontSize: 11 }}>
                {activePhotoIdx + 1}/{mediaList.length}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Overlay Details (Name, Age, Verified, Location, Occupation) */}
        <View style={styles.imageDetailsOverlay} pointerEvents="box-none">
          <View style={styles.nameRow}>
            <Heading level={isCompact ? 'h3' : 'h2'} style={styles.displayNameText}>
              {profile.name}, {profile.age}
            </Heading>
            {effectiveVerified && (
              <View style={styles.verifiedBadge}>
                <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
          </View>

          {effectiveCity && (
            <View style={styles.locationRow}>
              <Icon name="location" size={13} color="#E7E2DA" style={{ marginRight: 5 }} />
              <Text variant="bodySmall" style={{ color: '#E7E2DA', fontWeight: '500' }}>
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </Text>
            </View>
          )}

          {profile.occupation && (
            <View style={styles.occupationRow}>
              <Icon name="briefcase" size={12} color="#D1C9BE" style={{ marginRight: 5 }} />
              <Text
                variant="caption"
                style={{ color: '#D1C9BE', fontWeight: '400' }}
                numberOfLines={1}
              >
                {profile.occupation}
                {profile.education ? ` · ${profile.education}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Body Details (Bio, Interests, Prompts) */}
      {!isCompact && (
        <View style={{ padding: spacing.md }}>
          {profile.bio ? (
            <Text
              variant="body"
              style={{
                color: colors.textPrimary,
                marginBottom: spacing.md,
                lineHeight: 23,
                letterSpacing: -0.1,
              }}
            >
              {profile.bio}
            </Text>
          ) : null}

          {/* Interests Chips */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text
                variant="label"
                style={{
                  color: colors.textSecondary,
                  marginBottom: spacing.xs,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontSize: 11,
                }}
              >
                Passions & Interests
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
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight="medium"
                      style={{ color: colors.textPrimary, fontSize: 13 }}
                    >
                      {interest}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Profile Editorial Prompts */}
          {profile.prompts &&
            profile.prompts.map((prompt, idx) => (
              <View
                key={idx}
                style={[
                  styles.promptCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderLeftColor: colors.accent,
                  },
                ]}
              >
                <View style={styles.promptContentRow}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text
                      variant="caption"
                      weight="bold"
                      style={{
                        color: colors.accent,
                        marginBottom: 4,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        fontSize: 11,
                      }}
                    >
                      {prompt.question}
                    </Text>
                    <Text
                      variant="body"
                      style={{
                        color: colors.textPrimary,
                        fontSize: 16,
                        lineHeight: 23,
                        fontWeight: '500',
                      }}
                    >
                      "{prompt.answer}"
                    </Text>
                  </View>
                  {onInlineLike && (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        onInlineLike({
                          type: 'PROMPT',
                          id: `prompt-${idx}`,
                          text: prompt.answer,
                        });
                      }}
                      style={[
                        styles.inlineHeartBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Like prompt: ${prompt.question}`}
                      activeOpacity={0.7}
                    >
                      <Icon name="heart" size="sm" color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

          {/* Audio Prompts */}
          {profile.audioPrompts &&
            profile.audioPrompts.map((audioPrompt, idx) => (
              <View
                key={`audio-${idx}`}
                style={[
                  styles.promptCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderLeftColor: colors.accent,
                  },
                ]}
              >
                <View style={styles.promptContentRow}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text
                      variant="caption"
                      weight="bold"
                      style={{
                        color: colors.accent,
                        marginBottom: 4,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        fontSize: 11,
                      }}
                    >
                      {audioPrompt.prompt}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View
                        style={[styles.audioPromptPlayBtn, { backgroundColor: colors.accentSoft }]}
                      >
                        <Icon name="mic" size="sm" color={colors.accent} />
                      </View>
                      <View style={{ marginLeft: spacing.sm }}>
                        <Text
                          variant="caption"
                          weight="semibold"
                          style={{ color: colors.textPrimary }}
                        >
                          Voice Prompt
                        </Text>
                        <Text
                          variant="caption"
                          style={{ color: colors.textSecondary, fontSize: 11 }}
                        >
                          {audioPrompt.durationSeconds}s audio recording
                        </Text>
                      </View>
                    </View>
                  </View>
                  {onInlineLike && (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        onInlineLike({
                          type: 'PROMPT',
                          id: audioPrompt.id,
                          text: `[Voice Prompt] ${audioPrompt.prompt}`,
                        });
                      }}
                      style={[
                        styles.inlineHeartBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Like voice prompt: ${audioPrompt.prompt}`}
                      activeOpacity={0.7}
                    >
                      <Icon name="heart" size="sm" color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Bottom Profile Action Row */}
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
                { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
              ]}
              onPress={() => {
                haptics.warning();
                onPass();
              }}
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
                { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.12)' },
              ]}
              onPress={() => {
                haptics.success();
                onSuperLike();
              }}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Super like ${profile.name}`}
            >
              <Icon name="star" size="md" color="#D97706" />
            </TouchableOpacity>
          )}

          {onMessage && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { borderColor: colors.info, backgroundColor: colors.infoSoft },
              ]}
              onPress={() => {
                haptics.selection();
                onMessage();
              }}
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
                { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
              onPress={() => {
                haptics.selection();
                onLike();
              }}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.name}`}
            >
              <Icon name="heart" size="md" color={colors.accent} fill={colors.accent} />
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
    borderRadius: 24,
    borderWidth: 1,
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
  tapAreasOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapAreaLeft: {
    flex: 1,
    height: '100%',
  },
  tapAreaRight: {
    flex: 1,
    height: '100%',
  },
  scrimOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    zIndex: 4,
  },
  storyProgressRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  storyProgressBar: {
    height: 3,
    borderRadius: 1.5,
  },
  topBadgesRow: {
    position: 'absolute',
    top: 20,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  contextualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 16, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: '75%',
  },
  imageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 16, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  imageDetailsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayNameText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  occupationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  promptCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
  },
  promptContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineHeartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  audioPromptPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  discoveryCard: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10,
  },
  discoveryTouchable: {
    width: '100%',
    height: '100%',
  },
  discoveryImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  discoveryImage: {
    width: '100%',
    height: '100%',
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
  discoveryDetailsOverlay: {
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
  tinderInfoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
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
  lifestyleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  lifestyleHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  discoveryNameText: {
    fontFamily: 'Folkra',
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  discoveryAgeText: {
    fontSize: 23,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.90)',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  discoveryVerifiedBadge: {
    marginLeft: 7,
    alignItems: 'center',
    justifyContent: 'center',
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
  flowingTaglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  flowingTaglineText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  flowingTaglineDot: {
    color: 'rgba(255, 255, 255, 0.45)',
    marginHorizontal: 6,
    fontSize: 12,
  },
  flowingTaglineLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoveryInterestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  discoveryInterestPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  discoveryInterestMore: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  discoveryInterestText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  promptTeaserBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  discoveryInlineHeartBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
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
  expandAffordanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 4,
  },
  expandAffordanceText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.2,
  },
  // Profile Preview Mode styles matching luxury screenshot design
  previewOuterBezel: {
    borderRadius: 42,
    padding: 7,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 32,
    elevation: 8,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  previewInnerCard: {
    borderRadius: 35,
    overflow: 'hidden',
    aspectRatio: 0.58,
    position: 'relative',
    width: '100%',
  },
  previewTapAreaLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '45%',
    zIndex: 5,
  },
  previewTapAreaRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '45%',
    zIndex: 5,
  },
  previewStoryProgressRow: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4.5,
    zIndex: 10,
  },
  previewStoryProgressBar: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  previewGradientScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    zIndex: 2,
  },
  previewOverlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 26,
    paddingTop: 14,
    zIndex: 10,
  },
  previewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewNameAndAge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  previewNameText: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  previewAgeText: {
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  previewBadgeWrapper: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewMetaText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  previewMetaDot: {
    fontSize: 11,
    marginHorizontal: 1,
  },
  previewBioText: {
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 21.5,
    letterSpacing: -0.1,
  },
});
