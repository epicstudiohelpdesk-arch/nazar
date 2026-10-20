import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
  Image as SvgImage,
  ClipPath,
} from 'react-native-svg';
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
  readonly showMatchBadge?: boolean;
  readonly showActionDock?: boolean;
}

export interface DiscoveryMatchPillProps {
  readonly matchPercentage?: number;
  readonly cardHeight: number;
  readonly style?: ViewStyle;
}

export const DiscoveryMatchPill: React.FC<DiscoveryMatchPillProps> = ({
  matchPercentage = 95,
  cardHeight,
  style,
}) => {
  const top = Math.max(2, Math.round(cardHeight * 0.108) - 46);
  return (
    <View style={[styles.matchBadgePill, { top, left: 2 }, style]} pointerEvents="box-none">
      <Text style={styles.matchBadgeText}>{matchPercentage}% match</Text>
    </View>
  );
};

export interface DiscoveryActionDockProps {
  readonly cardHeight: number;
  readonly onShare?: () => void;
  readonly onSuperLike?: () => void;
  readonly onLike?: () => void;
  readonly onMessage?: () => void;
  readonly style?: ViewStyle;
}

export const DiscoveryActionDock: React.FC<DiscoveryActionDockProps> = ({
  cardHeight,
  onShare,
  onSuperLike,
  onLike,
  onMessage,
  style,
}) => {
  const dockHeight = 164;
  const dockWidth = 48;
  const yScoopStart = Math.round(cardHeight * 0.384);
  const yScoopEnd = Math.round(cardHeight * 0.898);
  const dockTop = Math.round(yScoopStart + (yScoopEnd - yScoopStart - dockHeight) / 2);

  const handleStarPress = onSuperLike ?? onLike;

  return (
    <View
      style={[
        styles.verticalActionDock,
        {
          top: dockTop,
          right: 6,
          width: dockWidth,
          height: dockHeight,
        },
        style,
      ]}
      pointerEvents="box-none"
    >
      {/* Share Profile Button (Canonical iOS share sheet icon) */}
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
        <Icon name="share" size={18} color="#FFFFFF" strokeWidth={2.2} />
      </TouchableOpacity>

      {/* Star / Super Like Button */}
      <TouchableOpacity
        style={[styles.dockCircleBtn, styles.dockStarBtn]}
        onPress={(e) => {
          e.stopPropagation();
          haptics.medium();
          handleStarPress?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Super like profile"
        testID="discovery-super-btn"
      >
        <Icon name="star" size={20} color="#818CF8" strokeWidth={2.4} fill="#818CF8" />
      </TouchableOpacity>

      {/* Note / Message Button (Professional conversation message bubble) */}
      <TouchableOpacity
        style={styles.dockCircleBtn}
        onPress={(e) => {
          e.stopPropagation();
          haptics.selection();
          onMessage?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Send note"
      >
        <Icon name="message" size={18} color="#FFFFFF" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
};

/**
 * Professional Meta-style verified badge (royal blue scalloped rosette with crisp white checkmark)
 */
export const MetaVerifiedBadge: React.FC<{
  readonly size?: number;
  readonly style?: ViewStyle;
}> = ({ size = 19, style }) => {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M 10.52 2.5 C 11.23 1.83 12.77 1.83 13.48 2.5 L 14.73 3.67 C 15.22 4.13 15.89 4.35 16.55 4.26 L 18.23 4.04 C 19.27 3.9 20.1 4.73 19.96 5.77 L 19.74 7.45 C 19.65 8.11 19.87 8.78 20.33 9.27 L 21.5 10.52 C 22.17 11.23 22.17 12.77 21.5 13.48 L 20.33 14.73 C 19.87 15.22 19.65 15.89 19.74 16.55 L 19.96 18.23 C 20.1 19.27 19.27 20.1 18.23 19.96 L 16.55 19.74 C 15.89 19.65 15.22 19.87 14.73 20.33 L 13.48 21.5 C 12.77 22.17 11.23 22.17 10.52 21.5 L 9.27 20.33 C 8.78 19.87 8.11 19.65 7.45 19.74 L 5.77 19.96 C 4.73 20.1 3.9 19.27 4.04 18.23 L 4.26 16.55 C 4.35 15.89 4.13 15.22 3.67 14.73 L 2.5 13.48 C 1.83 12.77 1.83 11.23 2.5 10.52 L 3.67 9.27 C 4.13 8.78 4.35 8.11 4.26 7.45 L 4.04 5.77 C 3.9 4.73 4.73 3.9 5.77 4.04 L 7.45 4.26 C 8.11 4.35 8.78 4.13 9.27 3.67 Z"
          fill="#0095F6"
        />
        <Path
          d="M 8.5 12.2 L 10.8 14.5 L 15.8 9.5"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

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
  showMatchBadge = true,
  showActionDock = true,
}) => {
  const { colors, spacing, isDark } = useTheme();
  const screenBg = isDark ? '#0C0B15' : colors.background;
  const { isSmallScreen, isLargeScreen } = useResponsiveLayout();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [profile.id]);

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

  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const cardW = cardSize.width || 360;
  const cardH = cardSize.height || 560;

  const sanitizedId = useMemo(() => profile.id.replace(/[^a-zA-Z0-9_-]/g, ''), [profile.id]);
  const gradId = `card-grad-${sanitizedId}`;
  const glowId = `card-glow-${sanitizedId}`;
  const scrimId = `card-scrim-${sanitizedId}`;
  const clipId = `card-clip-${sanitizedId}`;

  const cardPath = useMemo(() => {
    const w = cardW;
    const h = cardH;
    const r = Math.min(30, Math.max(22, Math.round(w * 0.072)));
    const yNotch = Math.round(h * 0.108);
    const xNotchEnd = Math.round(w * 0.356);
    const xCeilStart = Math.round(w * 0.435);
    const yScoopStart = Math.round(h * 0.384);
    const yScoopIn = Math.round(h * 0.471);
    const scoopDepth = Math.min(72, Math.max(54, Math.round(w * 0.197)));
    const xRecess = w - scoopDepth;
    const yScoopOut = Math.round(h * 0.822);
    const yScoopEnd = Math.round(h * 0.898);
    const dxCeil = xCeilStart - xNotchEnd;
    const dyScoopIn = yScoopIn - yScoopStart;
    const dyScoopOut = yScoopEnd - yScoopOut;

    return [
      `M ${xCeilStart} 0`,
      `L ${w - r} 0`,
      `A ${r} ${r} 0 0 1 ${w} ${r}`,
      `L ${w} ${yScoopStart}`,
      `C ${w} ${yScoopStart + Math.round(dyScoopIn * 0.52)} ${xRecess} ${yScoopIn - Math.round(dyScoopIn * 0.52)} ${xRecess} ${yScoopIn}`,
      `L ${xRecess} ${yScoopOut}`,
      `C ${xRecess} ${yScoopOut + Math.round(dyScoopOut * 0.52)} ${w} ${yScoopEnd - Math.round(dyScoopOut * 0.52)} ${w} ${yScoopEnd}`,
      `L ${w} ${h}`,
      `L 0 ${h}`,
      `L 0 ${yNotch + r}`,
      `A ${r} ${r} 0 0 1 ${r} ${yNotch}`,
      `L ${xNotchEnd} ${yNotch}`,
      `C ${xNotchEnd + Math.round(dxCeil * 0.5)} ${yNotch} ${xCeilStart - Math.round(dxCeil * 0.5)} 0 ${xCeilStart} 0`,
      'Z',
    ].join(' ');
  }, [cardW, cardH]);

  if (isDiscovery) {
    return (
      <View
        style={[styles.discoveryCard, style]}
        testID={testID || `profile-card-${profile.id}`}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0 && (width !== cardSize.width || height !== cardSize.height)) {
            setCardSize({ width, height });
          }
        }}
      >
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={onPress}
          style={styles.discoveryTouchable}
          accessibilityRole="button"
          accessibilityLabel={`View full profile for ${profile.name}`}
        >
          {/* Sculpted Die-Cut Background & Silhouette */}
          <Svg
            width={cardW}
            height={cardH}
            viewBox={`0 0 ${cardW} ${cardH}`}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <SvgLinearGradient id={gradId} x1="0.95" y1="0" x2="0.1" y2="1">
                <Stop offset="0%" stopColor="#342139" />
                <Stop offset="34%" stopColor="#63354F" />
                <Stop offset="68%" stopColor="#9D4D70" />
                <Stop offset="88%" stopColor="#221626" />
                <Stop offset="96%" stopColor={screenBg} />
                <Stop offset="100%" stopColor={screenBg} />
              </SvgLinearGradient>
              <RadialGradient id={glowId} cx="34%" cy="48%" r="65%">
                <Stop offset="0%" stopColor="#D58D91" stopOpacity="0.85" />
                <Stop offset="42%" stopColor="#BE6B83" stopOpacity="0.75" />
                <Stop offset="78%" stopColor="#A24A72" stopOpacity="0.45" />
                <Stop offset="100%" stopColor={screenBg} stopOpacity="0" />
              </RadialGradient>
              <SvgLinearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={screenBg} stopOpacity="0" />
                <Stop offset="25%" stopColor={screenBg} stopOpacity="0.15" />
                <Stop offset="50%" stopColor={screenBg} stopOpacity="0.55" />
                <Stop offset="72%" stopColor={screenBg} stopOpacity="0.88" />
                <Stop offset="88%" stopColor={screenBg} stopOpacity="0.98" />
                <Stop offset="100%" stopColor={screenBg} stopOpacity="1" />
              </SvgLinearGradient>
              <ClipPath id={clipId}>
                <Path d={cardPath} />
              </ClipPath>
            </Defs>

            {/* Base Plum Linear Gradient */}
            <Path d={cardPath} fill={`url(#${gradId})`} />

            {/* Luminous Warm Radial Glow */}
            <Path d={cardPath} fill={`url(#${glowId})`} />

            {/* Profile Photo when available, masked strictly to sculpted silhouette */}
            {currentPhoto ? (
              <SvgImage
                href={{ uri: currentPhoto }}
                width={cardW}
                height={cardH}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clipId})`}
              />
            ) : null}

            {/* Bottom Multi-Stop Dark Scrim clipped strictly to silhouette - creates smooth bottom fade */}
            <Rect
              x="0"
              y={cardH * 0.28}
              width={cardW}
              height={cardH * 0.72}
              fill={`url(#${scrimId})`}
              clipPath={`url(#${clipId})`}
            />
          </Svg>

          {/* Placeholder center text when no photo */}
          {!currentPhoto && (
            <View style={styles.placeholderCenter} pointerEvents="none">
              <Text style={styles.placeholderText}>Profile photo placeholder</Text>
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

          {/* Top Story Progress Bars on Raised Ceiling (Dynamic segments matching number of photos) */}
          {mediaList.length > 1 && (
            <View
              style={[
                styles.discoveryProgressRow,
                {
                  top: 13,
                  left: Math.round(cardW * 0.44),
                  right: 18,
                },
              ]}
              pointerEvents="none"
            >
              {mediaList.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.discoveryProgressBar,
                    {
                      backgroundColor:
                        idx === activePhotoIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.38)',
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Top Left Match Score Pill (% match) embedded in stepped notch */}
          {showMatchBadge && (
            <DiscoveryMatchPill
              matchPercentage={profile.matchPercentage ?? 95}
              cardHeight={cardH}
            />
          )}

          {/* Right-Side Vertical Action Dock inside Scoop Recess */}
          {showActionDock && (
            <DiscoveryActionDock
              cardHeight={cardH}
              onShare={onShare}
              onSuperLike={onSuperLike ?? onLike}
              onMessage={() => {
                if (onInlineLike) {
                  onInlineLike({
                    type: 'PROMPT',
                    id: 'prompt-0',
                    text: featuredPrompt?.answer || 'indie music & weekend trips',
                  });
                } else {
                  onMessage?.();
                }
              }}
            />
          )}

          {/* Bottom Content Area */}
          <View
            style={[
              styles.discoveryDetailsOverlay,
              {
                right: Math.min(76, Math.round(cardW * 0.197) + 8),
              },
            ]}
            pointerEvents="box-none"
          >
            {/* 1. Compact Name, Age & Meta Verified Badge */}
            <View style={styles.nameHeaderRow}>
              <View style={styles.discoveryNameRow}>
                <Text style={styles.discoveryNameText} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={styles.discoveryAgeText}> {profile.age}</Text>
                {effectiveVerified && (
                  <MetaVerifiedBadge size={19} style={styles.metaVerifiedBadge} />
                )}
              </View>
            </View>

            {/* 2. Professional Occupation & Education Subtitle */}
            {(profile.occupation || profile.education) && (
              <Text style={styles.occupationSubtitleText} numberOfLines={1}>
                {profile.occupation || ''}
                {profile.occupation && profile.education ? ' · ' : ''}
                {profile.education || ''}
              </Text>
            )}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 85,
    flexDirection: 'row',
    zIndex: 8,
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
    position: 'relative',
    backgroundColor: 'transparent',
  },
  discoveryTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
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
    position: 'absolute',
    top: '41%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontSize: 14.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 15,
  },
  discoveryProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4B72',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
  },
  matchBadgeText: {
    color: '#0C0B15',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  locationBadgePill: {
    position: 'absolute',
    backgroundColor: 'rgba(28, 22, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 16,
    zIndex: 15,
  },
  locationBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  verticalActionDockRecess: {
    display: 'none',
  },
  verticalActionDock: {
    position: 'absolute',
    backgroundColor: 'rgba(23, 19, 36, 0.94)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#231D36',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHeartBtn: {
    backgroundColor: '#FF4B72',
    borderColor: '#FF4B72',
  },
  dockStarBtn: {
    backgroundColor: 'rgba(129, 140, 248, 0.16)',
    borderColor: 'rgba(129, 140, 248, 0.35)',
  },
  discoveryDetailsOverlay: {
    position: 'absolute',
    bottom: 76,
    left: 18,
    zIndex: 15,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  discoveryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoveryNameText: {
    fontSize: 25,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  discoveryAgeText: {
    fontSize: 23,
    fontWeight: '400',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  metaVerifiedBadge: {
    marginLeft: 8,
  },
  occupationSubtitleText: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.82)',
    letterSpacing: 0.1,
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
    backgroundColor: 'rgba(28, 22, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
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
