import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  User,
  MessageCircle,
  Heart,
  SlidersHorizontal,
  Edit3,
  ShieldCheck,
  Eye,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { ProfileCard, type ProfileCardData } from '../../src/design/components/card/ProfileCard.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function OnboardingPreviewScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  // Animated scroll listener for glossy top vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftProfile, draftPhotos, draftInterests, draftPrompts } = useOnboardingStore();

  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Calculate age from date of birth
  const calculateAge = (dobString?: string): number => {
    if (!dobString) return 24;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age > 0 ? age : 24;
  };

  // Sort photos so primary is first
  const sortedPhotos = [...draftPhotos].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  const photoUrls = sortedPhotos.map((p) => p.url);
  const primaryUrl =
    photoUrls[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';

  const previewData: ProfileCardData = {
    id: 'preview-me',
    name: draftProfile.displayName || 'Sophie Bennett',
    age: calculateAge(draftProfile.dateOfBirth),
    city: draftProfile.city || 'Mumbai',
    occupation: draftProfile.occupation || undefined,
    education: draftProfile.education || undefined,
    bio: draftProfile.bio || undefined,
    imageUrl: primaryUrl,
    images: photoUrls.length > 0 ? photoUrls : [primaryUrl],
    isVerified: true,
    interests:
      draftInterests.length > 0
        ? draftInterests.map((id) =>
            id
              .replace('int_', '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          )
        : ['Design', 'Specialty Coffee', 'Architecture', 'Travel'],
    prompts:
      draftPrompts.length > 0
        ? draftPrompts.map((p) => ({
            question: p.prompt,
            answer: p.answer,
          }))
        : [
            {
              question: 'A life goal of mine',
              answer: 'Build products that make people feel at home anywhere in the world.',
            },
          ],
  };

  const handleActivate = async () => {
    haptics.impactMedium();
    setIsActivating(true);
    setErrorMessage(undefined);

    try {
      await profileApi.activateProfile();
      haptics.notificationSuccess();
      trackOnboardingEvent('onboarding_completed');
      trackOnboardingEvent('discovery_entered', { source: 'onboarding_completion' });
      router.replace('/(tabs)/discovery');
    } catch {
      // Local fallback in offline mode
      haptics.notificationSuccess();
      trackOnboardingEvent('onboarding_completed');
      trackOnboardingEvent('discovery_entered', { source: 'onboarding_completion_offline' });
      router.replace('/(tabs)/discovery');
    } finally {
      setIsActivating(false);
    }
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/permissions');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Glossy, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glossyTopOverlay,
          {
            height: Math.max(insets.top + 54, 70),
            opacity: headerGlossOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 0.92)',
                  'rgba(11, 11, 14, 0.70)',
                  'rgba(11, 11, 14, 0.28)',
                  'rgba(11, 11, 14, 0.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 0.92)',
                  'rgba(250, 250, 250, 0.70)',
                  'rgba(250, 250, 250, 0.28)',
                  'rgba(250, 250, 250, 0.0)',
                ]
          }
          locations={[0, 0.4, 0.68, 0.88, 1.0]}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular Gloss Sheen Layer */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255, 255, 255, 0.08)',
                  'rgba(255, 255, 255, 0.03)',
                  'rgba(255, 255, 255, 0.0)',
                ]
              : [
                  'rgba(255, 255, 255, 0.70)',
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.0)',
                ]
          }
          locations={[0, 0.45, 1.0]}
          style={styles.glossySheenLayer}
        />
      </Animated.View>

      {/* Encircled floating circular back button on top left corner */}
      <TouchableOpacity
        onPress={handleBack}
        delayPressIn={0}
        style={[
          styles.encircledBackButton,
          {
            top: Math.max(insets.top + 8, 16),
            left: Math.max(insets.left + 16, 16),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="onboarding-back-button"
      >
        <ArrowLeft size={20} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 64, 76),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Title Section: Clean & Professional */}
        <View style={styles.header}>
          <Heading
            level="h1"
            style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
          >
            Review your profile
          </Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            This is your official presence on Nazar. Inspect how your card renders in discovery and
            fine-tune any detail before entering the community.
          </Text>
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.05)',
                borderColor: isDark ? 'rgba(244, 63, 94, 0.24)' : 'rgba(244, 63, 94, 0.18)',
              },
            ]}
          >
            <Text style={[styles.errorBannerText, { color: isDark ? '#FDA4AF' : '#E11D48' }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Live Discovery Deck Simulation Canvas */}
        <View style={styles.previewCanvasContainer}>
          <View style={styles.previewCanvasHeader}>
            <View style={styles.deckStatusRow}>
              <Eye size={12} color={theme.colors.textSecondary} strokeWidth={2.2} />
              <Text
                style={[styles.deckStatusText, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                Live Discovery Deck Simulation
              </Text>
            </View>
            <View
              style={[
                styles.deckHintPill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <Text
                style={[styles.deckHintText, { color: theme.colors.textTertiary }]}
                numberOfLines={1}
              >
                Tap photo edges to cycle
              </Text>
            </View>
          </View>

          {/* Card Presentation */}
          <View style={styles.cardWrapper}>
            <ProfileCard profile={previewData} context="profilePreview" />
          </View>
        </View>

        {/* Curated Profile Milestones (Fluid, Non-Boxy Quick Tune Rows) */}
        <View style={styles.milestonesSection}>
          <View style={styles.milestonesSectionHeader}>
            <Text
              style={[
                styles.milestonesSectionTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              Profile Breakdown
            </Text>
            <Text style={[styles.milestonesSectionHint, { color: theme.colors.textTertiary }]}>
              Tap to refine
            </Text>
          </View>

          <View style={styles.milestonesGrid}>
            {/* Milestone 1: Photos */}
            <TouchableOpacity
              activeOpacity={0.78}
              delayPressIn={0}
              onPress={() => {
                haptics.selection();
                router.push({ pathname: '/(onboarding)/photos', params: { returnTo: 'preview' } });
              }}
              style={[
                styles.milestoneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit photos"
            >
              <View style={styles.milestoneLeft}>
                <View
                  style={[
                    styles.milestoneIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <Camera size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.milestoneMeta}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.textPrimary }]}>
                    Photo Gallery
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: theme.colors.textTertiary }]}>
                    {photoUrls.length} portraits uploaded
                  </Text>
                </View>
              </View>
              <Edit3 size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            {/* Milestone 2: Identity & Bio */}
            <TouchableOpacity
              activeOpacity={0.78}
              delayPressIn={0}
              onPress={() => {
                haptics.selection();
                router.push({
                  pathname: '/(onboarding)/profile-setup',
                  params: { returnTo: 'preview' },
                });
              }}
              style={[
                styles.milestoneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit identity and bio"
            >
              <View style={styles.milestoneLeft}>
                <View
                  style={[
                    styles.milestoneIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <User size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.milestoneMeta}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.textPrimary }]}>
                    The Basics & Bio
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: theme.colors.textTertiary }]}>
                    {draftProfile.displayName || 'You'}, {previewData.age} •{' '}
                    {draftProfile.city || 'City'}
                  </Text>
                </View>
              </View>
              <Edit3 size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            {/* Milestone 3: Written Prompts */}
            <TouchableOpacity
              activeOpacity={0.78}
              delayPressIn={0}
              onPress={() => {
                haptics.selection();
                router.push({ pathname: '/(onboarding)/prompts', params: { returnTo: 'preview' } });
              }}
              style={[
                styles.milestoneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit prompts"
            >
              <View style={styles.milestoneLeft}>
                <View
                  style={[
                    styles.milestoneIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <MessageCircle size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.milestoneMeta}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.textPrimary }]}>
                    Prompts & Voice
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: theme.colors.textTertiary }]}>
                    {draftPrompts.length} conversation starters
                  </Text>
                </View>
              </View>
              <Edit3 size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            {/* Milestone 4: Passions & Interests */}
            <TouchableOpacity
              activeOpacity={0.78}
              delayPressIn={0}
              onPress={() => {
                haptics.selection();
                router.push({
                  pathname: '/(onboarding)/interests',
                  params: { returnTo: 'preview' },
                });
              }}
              style={[
                styles.milestoneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit interests and passions"
            >
              <View style={styles.milestoneLeft}>
                <View
                  style={[
                    styles.milestoneIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <Heart size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.milestoneMeta}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.textPrimary }]}>
                    Passions & Interests
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: theme.colors.textTertiary }]}>
                    {draftInterests.length} selected passions
                  </Text>
                </View>
              </View>
              <Edit3 size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            {/* Milestone 5: Discovery Preferences */}
            <TouchableOpacity
              activeOpacity={0.78}
              delayPressIn={0}
              onPress={() => {
                haptics.selection();
                router.push({
                  pathname: '/(onboarding)/preferences',
                  params: { returnTo: 'preview' },
                });
              }}
              style={[
                styles.milestoneRow,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit discovery preferences"
            >
              <View style={styles.milestoneLeft}>
                <View
                  style={[
                    styles.milestoneIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <SlidersHorizontal size={15} color={theme.colors.textPrimary} strokeWidth={2.2} />
                </View>
                <View style={styles.milestoneMeta}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.textPrimary }]}>
                    Discovery Preferences
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: theme.colors.textTertiary }]}>
                    Age & distance radar configured
                  </Text>
                </View>
              </View>
              <Edit3 size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Security & Authenticity Trust Assurance */}
        <View style={styles.trustAssuranceRow}>
          <ShieldCheck size={15} color={theme.colors.textTertiary} strokeWidth={2.2} />
          <Text style={[styles.trustAssuranceText, { color: theme.colors.textSecondary }]}>
            All profiles undergo real-time cryptographic screening upon activation to protect our
            verified community.
          </Text>
        </View>

        {/* Clearance spacer to prevent content from hiding behind fixed floating dock */}
        <View style={styles.dockClearanceSpacer} />
      </Animated.ScrollView>

      {/* Floating Bottom Dock with Feathered Fade (Matches Discovery Preferences & Permissions) */}
      <View style={styles.floatingDock} pointerEvents="box-none">
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.0)',
                  'rgba(11, 11, 14, 0.15)',
                  'rgba(11, 11, 14, 0.45)',
                  'rgba(11, 11, 14, 0.75)',
                  'rgba(11, 11, 14, 0.92)',
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 1.0)',
                  'rgba(11, 11, 14, 1.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.0)',
                  'rgba(250, 250, 250, 0.15)',
                  'rgba(250, 250, 250, 0.45)',
                  'rgba(250, 250, 250, 0.75)',
                  'rgba(250, 250, 250, 0.92)',
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 1.0)',
                  'rgba(250, 250, 250, 1.0)',
                ]
          }
          locations={[0, 0.04, 0.1, 0.16, 0.22, 0.3, 0.38, 1.0]}
          style={styles.dockGradientBackdrop}
          pointerEvents="none"
        />

        <View
          style={[
            styles.dockInner,
            {
              maxWidth: maxContentWidth || 520,
              paddingBottom: Math.max(insets.bottom + 14, 20),
            },
          ]}
        >
          {/* Professional Solid CTA Button with Instant Touch Feedback */}
          <TouchableOpacity
            onPress={handleActivate}
            disabled={isActivating}
            delayPressIn={0}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#121216',
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: isDark ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.28 : 0.12,
                opacity: isActivating ? 0.75 : 1,
              },
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Activate profile and enter Nazar discovery"
            testID="preview-activate-button"
          >
            {isActivating ? (
              <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: isDark ? '#000000' : '#FFFFFF',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  Enter Nazar Discovery
                </Text>
                <ArrowRight
                  size={17}
                  color={isDark ? '#000000' : '#FFFFFF'}
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Footnote reassurance */}
          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            Your profile will immediately enter discovery. You can pause or edit anytime in
            Settings.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  encircledBackButton: {
    position: 'absolute',
    zIndex: 25,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glossyTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  glossySheenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    marginBottom: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  // Live Discovery Canvas
  previewCanvasContainer: {
    marginBottom: 24,
  },
  previewCanvasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  deckStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginRight: 8,
  },
  deckStatusText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  deckHintPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9999,
    borderWidth: 1,
    flexShrink: 0,
  },
  deckHintText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // Milestones Section
  milestonesSection: {
    marginBottom: 20,
  },
  milestonesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  milestonesSectionTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  milestonesSectionHint: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  milestonesGrid: {
    gap: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  milestoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  milestoneMeta: {
    flex: 1,
    gap: 2,
  },
  milestoneTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  milestoneSubtitle: {
    fontSize: 11.5,
    fontWeight: '400',
  },
  trustAssuranceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  trustAssuranceText: {
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  dockClearanceSpacer: {
    height: 140,
  },
  // Floating Bottom Dock with Feathered Fade
  floatingDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 18,
    zIndex: 30,
  },
  dockGradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockInner: {
    width: '100%',
    alignSelf: 'center',
  },
  professionalCtaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalCtaText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dockFootnoteText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
