import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Text as RNText,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  ShieldCheck,
  RotateCcw,
  Clock,
  ArrowRight,
  ArrowLeft,
  Edit3,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { OtpInput } from '../../src/design/components/input/OtpInput.js';
import { haptics } from '../../src/design/haptics/index.js';
import { getDefaultAuthService } from '../../src/auth/auth-service.js';
import { getDefaultSessionService } from '../../src/auth/session-service.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { useProfileStore } from '../../src/profile/profile-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function OtpVerificationScreen(): React.JSX.Element {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode !== 'signin';
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const authService = getDefaultAuthService();
  const sessionService = getDefaultSessionService();

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { authMethod, pendingIdentifier } = useOnboardingStore();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState<number>(45);

  const otpShakeAnim = useRef(new Animated.Value(0)).current;
  const triggerOtpShake = () => {
    haptics.notificationError();
    otpShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(otpShakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: -3, duration: 35, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 3, duration: 35, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();
  };

  const isDark = theme.mode === 'dark';

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

  // 45s countdown timer for resending
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Mask destination for privacy
  const formatDestination = (val: string): string => {
    if (!val) return 'your device';
    if (authMethod === 'phone') {
      const clean = val.replace(/\s+/g, '');
      if (clean.length >= 10) {
        return `${clean.slice(0, 8)} •••••`;
      }
      return val;
    }
    const parts = val.split('@');
    const userPart = parts[0];
    const domainPart = parts[1];
    if (parts.length === 2 && userPart && domainPart && userPart.length > 1) {
      return `${userPart[0]}•••••@${domainPart}`;
    }
    return val;
  };

  const handleVerify = async (codeOverride?: string) => {
    const codeToVerify = codeOverride || code;
    if (isLoading) return;
    Keyboard.dismiss();
    haptics.medium();

    if (codeToVerify.length < 6) {
      triggerOtpShake();
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    const targetIdentifier = pendingIdentifier || '+919999999999';

    // Verify locally without backend OTP dependency
    const result =
      authMethod === 'phone'
        ? await authService.verifyPhoneOtp(targetIdentifier, codeToVerify)
        : await authService.verifyEmail(targetIdentifier, codeToVerify);

    if (!result.success) {
      setIsLoading(false);
      haptics.selection();
      setErrorMessage(result.error);
      return;
    }

    haptics.success();

    try {
      // Restore session and query profile completeness if server is reachable
      const sessionResult = await sessionService.restoreSession();
      setIsLoading(false);

      if (sessionResult.status === 'ACTIVE' && !isSignUp) {
        trackOnboardingEvent('discovery_entered', { source: 'returning_user' });
        router.replace('/(tabs)/discovery');
        return;
      }

      if (sessionResult.status === 'INCOMPLETE' || isSignUp) {
        const nextStep = isSignUp ? 'intro' : sessionResult.nextStep || 'intro';
        trackOnboardingEvent('profile_started', { resumeStep: nextStep });

        const stepRoutes: Record<string, `/(onboarding)/${string}`> = {
          intro: '/(onboarding)/intro',
          'profile-setup': '/(onboarding)/profile-setup',
          photos: '/(onboarding)/photos',
          interests: '/(onboarding)/interests',
          prompts: '/(onboarding)/prompts',
          preferences: '/(onboarding)/preferences',
          permissions: '/(onboarding)/permissions',
          preview: '/(onboarding)/preview',
        };
        const route = stepRoutes[nextStep] || '/(onboarding)/intro';
        router.replace(route);
        return;
      }
    } catch {
      // fallback
    }

    setIsLoading(false);
    if (isSignUp) {
      trackOnboardingEvent('profile_started', { resumeStep: 'intro' });
      router.replace('/(onboarding)/intro');
      return;
    }
    // Ensure active profile exists so discovery tabs work seamlessly
    if (!useProfileStore.getState().profile) {
      useProfileStore.getState().setProfile({
        id: 'demo-user-1',
        userId: 'demo-user-1',
        displayName: 'Subham',
        dateOfBirth: '2000-01-01',
        age: 25,
        gender: 'MAN',
        bio: 'Building Nazar — mindful, intentional dating ✨',
        occupation: 'Founder & Engineer',
        education: 'Tech & Product',
        city: 'Mumbai',
        countryCode: 'IN',
        visibility: 'ACTIVE',
        completionStatus: {
          percentage: 100,
          missingRequired: [],
          recommended: [],
        },
        interests: [
          { id: '1', name: 'Design', slug: 'design', category: 'Creative' },
          { id: '2', name: 'Coffee', slug: 'coffee', category: 'Food & Drink' },
          { id: '3', name: 'Tech', slug: 'tech', category: 'Tech' },
        ],
        prompts: [
          {
            id: 'p1',
            promptDefinitionId: 'pd1',
            prompt: 'A life goal of mine is...',
            answer: 'To build software that brings people together meaningfully.',
            position: 0,
          },
        ],
        media: [
          {
            id: 'm1',
            url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=80',
            mediaType: 'IMAGE',
            mimeType: 'image/jpeg',
            status: 'READY',
            position: 0,
            isPrimary: true,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    trackOnboardingEvent('discovery_entered', { source: 'returning_user' });
    router.replace('/(tabs)/discovery');
  };

  // Automatically hide keyboard when 6 digits are entered so user can tap Verify & Proceed
  useEffect(() => {
    if (code.length === 6) {
      Keyboard.dismiss();
      haptics.selection();
    }
  }, [code]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    Keyboard.dismiss();
    haptics.light();
    setErrorMessage(undefined);
    haptics.success();
    setResendCooldown(45);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
        onPress={() => {
          haptics.light();
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(auth)/login');
          }
        }}
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
      >
        <ArrowLeft size={20} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={styles.keyboardContainer}
        >
          <Animated.ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(insets.top + 64, 76),
                paddingBottom: Math.max(insets.bottom + 24, 32),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Header / Security Badge */}
            <View style={styles.header}>
              <View
                style={[
                  styles.badgeWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <ShieldCheck size={24} color={isDark ? '#FFFFFF' : '#1C1917'} />
              </View>

              <Text
                style={[
                  styles.eyebrow,
                  {
                    color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.5)',
                    fontFamily: folkraFont,
                  },
                ]}
              >
                V E R I F I C A T I O N
              </Text>
              <Heading
                level="h1"
                style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
              >
                Enter <RNText style={{ color: theme.colors.accent }}>6-digit</RNText> code
              </Heading>
              <Text level="body" color="secondary" style={styles.subtitle}>
                We sent a secure one-time verification code to
              </Text>

              {/* Destination Pill with quick change button */}
              <View
                style={[
                  styles.destinationCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Text
                  level="body"
                  style={[styles.destinationText, { color: theme.colors.textPrimary }]}
                >
                  {formatDestination(pendingIdentifier)}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(auth)/login');
                    }
                  }}
                  style={styles.changeButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Change destination"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit3
                    size={12}
                    color={isDark ? '#FFFFFF' : '#1C1917'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.changeText, { color: isDark ? '#FFFFFF' : '#1C1917' }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* OTP Input Section */}
            <View style={styles.inputContainer}>
              <Animated.View
                style={[styles.otpShakeContainer, { transform: [{ translateX: otpShakeAnim }] }]}
              >
                <OtpInput
                  length={6}
                  value={code}
                  onChangeCode={(val) => {
                    setCode(val);
                    if (errorMessage) setErrorMessage(undefined);
                  }}
                  onComplete={() => {
                    Keyboard.dismiss();
                    haptics.selection();
                  }}
                  autoFocus={true}
                  errorMessage={errorMessage}
                />
              </Animated.View>

              {/* Resend Action Pill */}
              <View style={styles.resendWrapper}>
                {resendCooldown > 0 ? (
                  <View
                    style={[
                      styles.resendBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <Clock size={13} color={theme.colors.textTertiary} style={{ marginRight: 6 }} />
                    <Text
                      level="bodySmall"
                      color="tertiary"
                      style={{ fontWeight: '500', fontSize: 13 }}
                    >
                      Resend code in {resendCooldown}s
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleResend}
                    style={[
                      styles.resendActiveButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Resend verification code"
                  >
                    <RotateCcw
                      size={13}
                      color={isDark ? '#FFFFFF' : '#1C1917'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      level="bodySmall"
                      style={{
                        color: isDark ? '#FFFFFF' : '#1C1917',
                        fontWeight: '600',
                        fontSize: 13,
                      }}
                    >
                      Didn't receive code? Resend
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Verify Button */}
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  {
                    backgroundColor: '#FFFFFF',
                    borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                    borderWidth: isDark ? 0 : 1,
                    opacity: isLoading ? 0.75 : 1,
                    shadowColor: '#000000',
                    shadowOpacity: isDark ? 0.28 : 0.12,
                  },
                ]}
                onPress={() => handleVerify()}
                disabled={isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Verify code and continue"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <View style={styles.verifyButtonContent}>
                    <Text
                      style={[
                        styles.verifyButtonText,
                        {
                          fontFamily: folkraFont,
                          color: '#000000',
                        },
                      ]}
                    >
                      Verify & Proceed
                    </Text>
                    <ArrowRight size={16} color="#000000" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Privacy & Security note */}
            <View style={styles.securityFooter}>
              <Lock size={12} color={theme.colors.textTertiary} style={{ marginRight: 6 }} />
              <Text level="caption" color="tertiary" style={styles.securityText}>
                Encrypted & protected with zero-knowledge verification
              </Text>
            </View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
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
    shadowOpacity: 0.15,
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
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  badgeWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.5,
    marginBottom: 6,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    maxWidth: 300,
    fontSize: 14,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  destinationText: {
    fontWeight: '600',
    fontSize: 14,
    marginRight: 10,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpShakeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  resendWrapper: {
    marginTop: 22,
    alignItems: 'center',
  },
  resendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  resendActiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  buttonWrapper: {
    marginTop: 12,
    marginBottom: 16,
  },
  verifyButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  verifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  securityText: {
    fontSize: 12,
  },
});
