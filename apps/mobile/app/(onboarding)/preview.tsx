import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { Button } from '../../src/design/components/button/Button.js';
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

  // Calculate age
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
    name: draftProfile.displayName || 'You',
    age: calculateAge(draftProfile.dateOfBirth),
    city: draftProfile.city || 'Mumbai',
    occupation: draftProfile.occupation || undefined,
    education: draftProfile.education || undefined,
    bio: draftProfile.bio || undefined,
    imageUrl: primaryUrl,
    images: photoUrls.length > 0 ? photoUrls : [primaryUrl],
    isVerified: true,
    interests: draftInterests.map((id) => id.replace('int_', '').replace('-', ' ')),
    prompts: draftPrompts.map((p) => ({
      question: p.prompt,
      answer: p.answer,
    })),
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
      {/* Glossy, Faded, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
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
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              Review your profile
            </Heading>
            <View style={styles.reviewBadge}>
              <Text
                style={[
                  styles.reviewBadgeText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                FINAL
              </Text>
            </View>
          </View>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Here is how your profile will appear on Nazar discovery.
          </Text>
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error },
            ]}
          >
            <Text level="bodySmall" style={{ color: theme.colors.error, fontWeight: '600' }}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Profile Card Preview */}
        <View style={styles.cardWrapper}>
          <ProfileCard profile={previewData} context="profilePreview" />
        </View>

        {/* Quick Edit Links */}
        <View style={styles.editPillsRow}>
          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => {
              haptics.selection();
              router.push('/(onboarding)/profile-setup');
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit basic details"
          >
            <Icon name="edit" size="tiny" color={theme.colors.accent} />
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              Edit Basics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => {
              haptics.selection();
              router.push('/(onboarding)/photos');
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit photos"
          >
            <Icon name="camera" size="tiny" color={theme.colors.accent} />
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              Edit Photos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editPill, { borderColor: theme.colors.border }]}
            onPress={() => {
              haptics.selection();
              router.push('/(onboarding)/prompts');
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit prompts"
          >
            <Icon name="message" size="tiny" color={theme.colors.accent} />
            <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              Edit Prompts
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isActivating}
            onPress={handleActivate}
            accessibilityLabel="Activate profile and enter Nazar discovery"
          >
            Enter Nazar
          </Button>
        </View>
      </Animated.ScrollView>
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
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  reviewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardWrapper: {
    marginVertical: 20,
    alignItems: 'center',
  },
  editPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  buttonWrapper: {
    width: '100%',
  },
});
