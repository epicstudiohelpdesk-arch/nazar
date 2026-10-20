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
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
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
  readonly onShare?: () => void;
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
  onShare,
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

  const interestChips: { id: string; emoji: string; text: string }[] = [];
  if (profile.interests && profile.interests.length > 0) {
    profile.interests.slice(0, 3).forEach((interest, idx) => {
      const lower = interest.toLowerCase();
      let emoji = '✨';
      if (lower.includes('coffee') || lower.includes('drink') || lower.includes('wine')) emoji = '☕';
      else if (lower.includes('travel') || lower.includes('trip')) emoji = '✈';
      else if (lower.includes('music') || lower.includes('rock') || lower.includes('song')) emoji = '♫';
      else if (lower.includes('design') || lower.includes('art')) emoji = '🎨';
      else if (lower.includes('food') || lower.includes('ramen')) emoji = '🍜';
      else if (lower.includes('book') || lower.includes('read')) emoji = '📚';
      else if (lower.includes('trek') || lower.includes('outdoor')) emoji = '🏔️';
      else if (lower.includes('tech') || lower.includes('code')) emoji = '💻';
      interestChips.push({ id: `int-${idx}`, emoji, text: interest });
    });
  }
  if (interestChips.length === 0) {
    interestChips.push({ id: 'ic-1', emoji: '♫', text: 'Music' });
    interestChips.push({ id: 'ic-2', emoji: '✈', text: 'Travel' });
    interestChips.push({ id: 'ic-3', emoji: '☕', text: 'Coffee' });
  }

  if (isDiscovery) {
    return (
      <View
        style={[
          styles.discoveryCard,
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
          <View style={[styles.discoveryImageWrapper, { backgroundColor: '#2D1B36' }]}>
            {currentPhoto ? (
              <Image
                source={{ uri: currentPhoto }}
                style={styles.discoveryImage}
                resizeMode="cover"
                accessibilityLabel={`${profile.name}'s profile photo`}
              />
            ) : (
              <LinearGradient
                colors={['#342139', '#63354F', '#9D4D70', '#3A2536']}
                locations={[0, 0.34, 0.68, 1]}
                start={{ x: 0.95, y: 0 }}
                end={{ x: 0.1, y: 1 }}
                style={styles.discoveryImage}
              >
                <Svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <RadialGradient
                      id={`profile-placeholder-glow-${profile.id.replace(/[^a-zA-Z0-9_-]/g, '')}`}
                      cx="34%"
                      cy="53%"
                      r="72%"
                    >
                      <Stop offset="0%" stopColor="#D58D91" stopOpacity="0.9" />
                      <Stop offset="42%" stopColor="#BE6B83" stopOpacity="0.8" />
                      <Stop offset="78%" stopColor="#A24A72" stopOpacity="0.52" />
                      <Stop offset="100%" stopColor="#241B2B" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    fill={`url(#profile-placeholder-glow-${profile.id.replace(/[^a-zA-Z0-9_-]/g, '')})`}
                  />
                </Svg>
                <View style={styles.placeholderCenter}>
                  <Text style={styles.placeholderText}>Profile photo placeholder</Text>
                </View>
              </LinearGradient>
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
                'rgba(12, 11, 20, 0.75)',
                'rgba(12, 11, 20, 0.35)',
                'rgba(12, 11, 20, 0.05)',
                'transparent',
              ]}
              locations={[0, 0.35, 0.7, 1]}
              style={styles.topVignette}
              pointerEvents="none"
            />

            {/* Bottom Multi-Stop Dark Scrim */}
            <LinearGradient
              colors={[
                'transparent',
                'rgba(12, 11, 20, 0.15)',
                'rgba(12, 11, 20, 0.65)',
                'rgba(12, 11, 20, 0.95)',
              ]}
              locations={[0, 0.3, 0.65, 1]}
              style={styles.discoveryScrim}
              pointerEvents="none"
            />

            {/* Top Story Progress Bars (4 bars as in reference screenshot) */}
            <View style={styles.discoveryProgressRow} pointerEvents="none">
              {(mediaList.length > 1 ? mediaList : [1, 2, 3, 4]).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.discoveryProgressBar,
                    {
                      backgroundColor:
                        idx === activePhotoIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
                    },
                  ]}
                />
              ))}
            </View>

            {/* Top Badges Row */}
            <View style={styles.discoveryTopBadgesRow} pointerEvents="box-none">
              {/* Left Match Score Pill with coral pink background (#FF4B72) */}
              <View style={styles.matchBadgePill}>
                <Icon name="sparkles" size={11} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.matchBadgeText}>{profile.matchPercentage ?? 95}% match</Text>
              </View>

              {/* Right Location & Distance Badge */}
              <View style={styles.locationBadgePill}>
                <Text style={styles.locationBadgeText}>
                  {profile.city || 'Kolkata'} · {effectiveDistance || '3 km away'}
                </Text>
              </View>
            </View>

            {/* Right-Side Recess and Vertical Action Dock */}
            <View style={styles.verticalActionDockRecess} pointerEvents="none" />
            <View style={styles.verticalActionDock} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.dockCircleBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  haptics.selection();
                  onShare?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="Share profile"
                testID="discovery-share-btn"
              >
                <Icon name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dockCircleBtn, styles.dockHeartBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  haptics.medium();
                  onLike?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="Like profile"
              >
                <Icon name="heart" size={18} color="#0C0B15" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dockCircleBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  haptics.selection();
                  onInlineLike?.({
                    type: 'PROMPT',
                    id: 'prompt-0',
                    text: featuredPrompt?.answer || 'indie music & weekend trips',
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="Send note"
              >
                <Icon name="message" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Bottom Content Area */}
            <View style={styles.discoveryDetailsOverlay} pointerEvents="box-none">
              {/* 1. Name, Age & Verified Checkmark */}
              <View style={styles.nameHeaderRow}>
                <View style={styles.discoveryNameRow}>
                  <Text style={styles.discoveryNameText} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <Text style={styles.discoveryAgeText}> {profile.age}</Text>
                  <View style={styles.blueVerifiedCircle}>
                    <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              </View>

              {/* 2. Occupation & Education Subtitle */}
              <Text style={styles.occupationSubtitleText} numberOfLines={1}>
                {profile.occupation || 'Graphic Designer'}
                {profile.education ? ` · ${profile.education}` : ' · Jadavpur University'}
              </Text>

              {/* 3. Interest Chips Row */}
              <View style={styles.interestChipsRow}>
                {interestChips.map((item) => (
                  <View key={item.id} style={styles.discoveryInterestChip}>
                    <Text style={styles.discoveryInterestChipEmoji}>{item.emoji}</Text>
                    <Text style={styles.discoveryInterestChipText}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {/* 4. "Why you match" Box */}
              <View style={styles.whyYouMatchBox}>
                <Text style={styles.whyYouMatchText}>
                  <Text style={styles.whyYouMatchHighlight}>Why you match</Text>
                  <Text style={styles.whyYouMatchContent}>
                    {' '}· {featuredPrompt?.answer || 'indie music & weekend trips'}
                  </Text>
                </Text>
              </View>
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
    borderWidth: 1.5,
    borderColor: '#6654A6',
    backgroundColor: '#1E1B2A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
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
  placeholderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -28 }],
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.2,
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
  discoveryProgressRow: {
    position: 'absolute',
    top: 14,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  discoveryProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  discoveryTopBadgesRow: {
    position: 'absolute',
    top: 5,
    left: 6,
    right: 14,
    height: 64,
    zIndex: 10,
  },
  matchBadgePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4B72',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
  },
  matchBadgeText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  locationBadgePill: {
    position: 'absolute',
    top: 27,
    right: 0,
    backgroundColor: 'rgba(22, 19, 32, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 22,
  },
  locationBadgeText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  verticalActionDockRecess: {
    position: 'absolute',
    right: -1,
    bottom: 62,
    width: 72,
    height: 184,
    backgroundColor: '#0C0B15',
    borderWidth: 1.5,
    borderColor: '#6553A3',
    borderTopLeftRadius: 36,
    borderBottomLeftRadius: 36,
    zIndex: 18,
  },
  verticalActionDock: {
    position: 'absolute',
    right: 8,
    bottom: 76,
    backgroundColor: '#171427',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#4F4488',
    padding: 5,
    gap: 8,
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  dockCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#201C30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHeartBtn: {
    backgroundColor: '#FF4B72',
    shadowColor: '#FF4B72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  discoveryDetailsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 18,
    right: 76,
    zIndex: 10,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  discoveryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoveryNameText: {
    fontFamily: 'Folkra',
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  discoveryAgeText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 255, 255, 0.6)',
  },
  blueVerifiedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  occupationSubtitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 4,
    marginBottom: 8,
  },
  interestChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  discoveryInterestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 20, 36, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  discoveryInterestChipEmoji: {
    fontSize: 13,
    marginRight: 4,
    color: '#FFFFFF',
  },
  discoveryInterestChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  interestChipEmoji: {
    fontSize: 12,
    marginRight: 4,
    color: '#FFFFFF',
  },
  interestChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  whyYouMatchBox: {
    backgroundColor: 'rgba(20, 17, 30, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  whyYouMatchText: {
    fontSize: 13,
    lineHeight: 18,
  },
  whyYouMatchHighlight: {
    color: '#FF4B72',
    fontWeight: '700',
  },
  whyYouMatchContent: {
    color: '#FFFFFF',
    fontWeight: '500',
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
    color: '#FF2400',
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
