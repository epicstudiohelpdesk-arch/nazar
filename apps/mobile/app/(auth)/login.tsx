import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Phone,
  Mail,
  AlertCircle,
  Sparkles,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Text } from '../../src/design/primitives/Text.js';
import { haptics } from '../../src/design/haptics/index.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';
import { getDefaultAuthService } from '../../src/auth/auth-service.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { useProfileStore } from '../../src/profile/profile-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import {
  GoogleIcon,
  PasskeyIcon,
} from '../../src/design/components/icons/BrandIcons.js';
import { promptGoogleSignIn } from '../../src/auth/google-auth.js';
import {
  promptPasskeyLogin,
  promptPasskeySignUp,
  checkPasskeyAvailability,
  type PasskeyAvailability,
} from '../../src/auth/passkey-auth.js';
import { getDefaultSessionService } from '../../src/auth/session-service.js';

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  maxLength: number;
}

const DEFAULT_COUNTRY: Country = {
  name: 'India',
  code: 'IN',
  dialCode: '+91',
  flag: '🇮🇳',
  placeholder: '98765 43210',
  maxLength: 10,
};

const COUNTRIES: Country[] = [
  DEFAULT_COUNTRY,
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', placeholder: '202 555 0199', maxLength: 10 },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456', maxLength: 10 },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', placeholder: '416 555 0143', maxLength: 10 },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', placeholder: '412 345 678', maxLength: 9 },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567', maxLength: 9 },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', placeholder: '8123 4567', maxLength: 8 },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', placeholder: '151 23456789', maxLength: 11 },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', maxLength: 9 },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678', maxLength: 9 },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567', maxLength: 9 },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦', placeholder: '3312 3456', maxLength: 8 },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼', placeholder: '9123 4567', maxLength: 8 },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', placeholder: '21 123 4567', maxLength: 9 },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', placeholder: '85 123 4567', maxLength: 9 },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', placeholder: '78 123 45 67', maxLength: 9 },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', placeholder: '70 123 45 67', maxLength: 9 },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78', maxLength: 9 },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789', maxLength: 10 },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', placeholder: '90 1234 5678', maxLength: 10 },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷', placeholder: '10 1234 5678', maxLength: 10 },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234 5678', maxLength: 11 },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', placeholder: '71 123 4567', maxLength: 9 },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', placeholder: '12 345 6789', maxLength: 10 },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', placeholder: '812 3456 7890', maxLength: 11 },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭', placeholder: '917 123 4567', maxLength: 10 },
  { name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵', placeholder: '984 1234567', maxLength: 10 },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', placeholder: '1712 345678', maxLength: 10 },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰', placeholder: '71 234 5678', maxLength: 9 },
];

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode !== 'signin';

  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [suggestionMode, setSuggestionMode] = useState<'signin' | 'signup' | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  const phoneInputRef = useRef<RNTextInput>(null);
  const emailInputRef = useRef<RNTextInput>(null);
  const searchInputRef = useRef<RNTextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { setAuthIdentifier } = useOnboardingStore();

  const handleTabSwitch = (newTab: 'phone' | 'email') => {
    if (newTab === activeTab) return;
    haptics.selection();
    setActiveTab(newTab);
    setErrorMessage(undefined);
    setSuggestionMode(null);
    // Smoothly focus corresponding input if already focused
    if (isInputFocused) {
      setTimeout(() => {
        if (newTab === 'phone') {
          phoneInputRef.current?.focus();
        } else {
          emailInputRef.current?.focus();
        }
      }, 50);
    }
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const [passkeyInfo, setPasskeyInfo] = useState<PasskeyAvailability | null>(null);

  useEffect(() => {
    checkPasskeyAvailability()
      .then((info) => setPasskeyInfo(info))
      .catch(() => {});
  }, []);

  useEffect(() => {
    trackOnboardingEvent('auth_started', {
      defaultMethod: 'phone',
      mode: isSignUp ? 'signup' : 'signin',
    });
  }, [isSignUp]);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Clean phone input (numbers only, max digits determined by selected country)
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, selectedCountry.maxLength);
    setPhoneNumber(cleaned);
    if (errorMessage) setErrorMessage(undefined);
    if (suggestionMode) setSuggestionMode(null);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text.trim());
    if (errorMessage) setErrorMessage(undefined);
    if (suggestionMode) setSuggestionMode(null);
  };

  const formatPhoneNumber = (num: string): string => {
    if (selectedCountry.code === 'IN') {
      if (num.length > 5) {
        return `${num.slice(0, 5)} ${num.slice(5)}`;
      }
      return num;
    }
    if (selectedCountry.code === 'US' || selectedCountry.code === 'CA') {
      if (num.length > 6) {
        return `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`;
      } else if (num.length > 3) {
        return `${num.slice(0, 3)} ${num.slice(3)}`;
      }
      return num;
    }
    if (num.length > 4) {
      return `${num.slice(0, 4)} ${num.slice(4)}`;
    }
    return num;
  };

  const handleContinue = async () => {
    if (rateLimitSeconds > 0 || isLoading) return;
    Keyboard.dismiss();
    haptics.medium();

    let fullIdentifier = '';
    let identifierType: 'PHONE' | 'EMAIL' = 'PHONE';

    if (activeTab === 'phone') {
      const minLength = Math.max(6, selectedCountry.maxLength - 3);
      if (phoneNumber.length < minLength) {
        setErrorMessage(`Please enter a valid mobile number for ${selectedCountry.name}.`);
        setSuggestionMode(null);
        return;
      }
      fullIdentifier = `${selectedCountry.dialCode}${phoneNumber}`;
      identifierType = 'PHONE';
    } else {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMessage('Please enter a valid email address.');
        setSuggestionMode(null);
        return;
      }
      fullIdentifier = email.trim();
      identifierType = 'EMAIL';
    }

    setErrorMessage(undefined);
    setSuggestionMode(null);
    setIsLoading(true);

    try {
      const authService = getDefaultAuthService();
      const checkResult = await authService.checkIdentifier(fullIdentifier, identifierType);

      if (checkResult.success && checkResult.data) {
        const { exists } = checkResult.data;

        // Sign In mode: verify account exists in database
        if (!isSignUp && !exists) {
          setIsLoading(false);
          haptics.notificationError();
          setErrorMessage(
            `No account found with this ${activeTab === 'phone' ? 'mobile number' : 'email'}. Tap below to create an account.`
          );
          setSuggestionMode('signup');
          return;
        }

        // Sign Up mode: prevent duplicate account creation
        if (isSignUp && exists) {
          setIsLoading(false);
          haptics.notificationError();
          setErrorMessage(
            `An account with this ${activeTab === 'phone' ? 'mobile number' : 'email'} already exists. Tap below to sign in.`
          );
          setSuggestionMode('signin');
          return;
        }
      }
    } catch {
      // Dev resilience / graceful offline fallback
    }

    setIsLoading(false);
    setAuthIdentifier(activeTab, fullIdentifier);
    haptics.success();
    router.push({
      pathname: '/(auth)/otp',
      params: { mode: isSignUp ? 'signup' : 'signin' },
    });
  };

  const handleSocialAuth = async (provider: 'google' | 'passkey') => {
    Keyboard.dismiss();
    haptics.light();
    setErrorMessage(undefined);
    setIsLoading(true);

    const sessionService = getDefaultSessionService();

    if (provider === 'passkey') {
      try {
        if (isSignUp) {
          const hasPhone = activeTab === 'phone' && phoneNumber.trim().length >= 6;
          const hasEmail = activeTab === 'email' && email.trim().length >= 3;

          if (!hasPhone && !hasEmail) {
            setIsLoading(false);
            setErrorMessage(
              `Please enter your ${activeTab === 'phone' ? 'mobile number' : 'email'} above, then tap Sign up with ${passkeyInfo?.label || 'Face ID'}.`
            );
            if (activeTab === 'phone') {
              phoneInputRef.current?.focus();
            } else {
              emailInputRef.current?.focus();
            }
            return;
          }

          const identifier =
            activeTab === 'phone'
              ? `${selectedCountry.dialCode}${phoneNumber}`
              : email.trim();

          try {
            const authService = getDefaultAuthService();
            const check = await authService.checkIdentifier(
              identifier,
              activeTab === 'phone' ? 'PHONE' : 'EMAIL'
            );
            if (check.success && check.data?.exists) {
              setIsLoading(false);
              haptics.notificationError();
              setErrorMessage(
                `An account with this ${activeTab === 'phone' ? 'mobile number' : 'email'} already exists. Tap below to sign in.`
              );
              setSuggestionMode('signin');
              return;
            }
          } catch {
            // Dev resilience
          }

          const result = await promptPasskeySignUp(identifier);
          setIsLoading(false);

          if (result.success) {
            haptics.success();
            trackOnboardingEvent('profile_started', { resumeStep: 'profile-setup' });
            router.replace('/(onboarding)/profile-setup');
            return;
          }

          if (result.cancelled) {
            return;
          }

          if (result.error) {
            setErrorMessage(result.error);
          }
          return;
        }

        // SIGN IN MODE
        const identifier =
          activeTab === 'phone' && phoneNumber
            ? `${selectedCountry.dialCode}${phoneNumber}`
            : email.trim() || undefined;

        const result = await promptPasskeyLogin({ emailOrPhone: identifier });
        setIsLoading(false);

        if (result.success) {
          haptics.success();
          const sessionResult = await sessionService.restoreSession();
          if (sessionResult.status === 'ACTIVE') {
            trackOnboardingEvent('discovery_entered', { source: 'passkey_signin' });
            router.replace('/(tabs)/discovery');
            return;
          }
          if (sessionResult.status === 'INCOMPLETE') {
            const nextStep = sessionResult.nextStep || 'profile-setup';
            const stepRoutes: Record<string, `/(onboarding)/${string}`> = {
              'profile-setup': '/(onboarding)/profile-setup',
              photos: '/(onboarding)/photos',
              interests: '/(onboarding)/interests',
              prompts: '/(onboarding)/prompts',
              preferences: '/(onboarding)/preferences',
              permissions: '/(onboarding)/permissions',
              preview: '/(onboarding)/preview',
            };
            router.replace(stepRoutes[nextStep] || '/(onboarding)/profile-setup');
            return;
          }
          router.replace('/(tabs)/discovery');
          return;
        }

        if (result.cancelled) {
          return;
        }

        if (result.error) {
          setErrorMessage(result.error);
        }
      } catch (err: unknown) {
        setIsLoading(false);
        setErrorMessage(
          err instanceof Error ? err.message : 'Passkey authentication failed. Please try again.'
        );
      }
      return;
    }

    if (provider === 'google') {
      try {
        const result = await promptGoogleSignIn();
        setIsLoading(false);
        if (result.success) {
          haptics.success();
          if (result.isNewUser) {
            trackOnboardingEvent('profile_started', { resumeStep: 'profile-setup' });
            router.replace('/(onboarding)/profile-setup');
            return;
          }

          // Returning user: query authoritative backend state
          const sessionResult = await sessionService.restoreSession();
          if (sessionResult.status === 'ACTIVE') {
            trackOnboardingEvent('discovery_entered', { source: 'google_signin' });
            router.replace('/(tabs)/discovery');
            return;
          }
          if (sessionResult.status === 'INCOMPLETE') {
            const nextStep = sessionResult.nextStep || 'profile-setup';
            const stepRoutes: Record<string, `/(onboarding)/${string}`> = {
              'profile-setup': '/(onboarding)/profile-setup',
              photos: '/(onboarding)/photos',
              interests: '/(onboarding)/interests',
              prompts: '/(onboarding)/prompts',
              preferences: '/(onboarding)/preferences',
              permissions: '/(onboarding)/permissions',
              preview: '/(onboarding)/preview',
            };
            router.replace(stepRoutes[nextStep] || '/(onboarding)/profile-setup');
            return;
          }

          router.replace('/(tabs)/discovery');
          return;
        }
        if (result.cancelled) {
          return;
        }
        if (result.error) {
          setErrorMessage(result.error);
        }
      } catch (err: unknown) {
        setIsLoading(false);
        setErrorMessage(
          err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.'
        );
      }
      return;
    }
  };

  const handleSkipAuth = async () => {
    Keyboard.dismiss();
    haptics.success();
    try {
      const storage = getDefaultAuthClient().getStorage();
      await storage.setAccessToken('dev-demo-token');
      await storage.setRefreshToken('dev-demo-refresh-token');
    } catch {
      // ignore dev bypass failure
    }

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

    router.replace('/(tabs)/discovery');
  };

  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Encircled floating circular back button on top left corner */}
      <TouchableOpacity
        onPress={() => {
          haptics.light();
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(auth)/welcome');
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
          <ScrollView
            ref={scrollViewRef}
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
          >
            {/* Creative & Catchy Hero Header */}
            <View style={styles.brandHero}>
              <View style={styles.headingBlock}>
                <Text style={[styles.headingLineOne, { color: theme.colors.textPrimary }]}>
                  {isSignUp ? 'Meet Someone' : 'Welcome Back,'}
                </Text>
                <View style={styles.headingLineTwoRow}>
                  <Text style={[styles.headingLineTwoLead, { color: theme.colors.textPrimary }]}>
                    {isSignUp ? 'Worth ' : 'Ready to '}
                  </Text>
                  <Text style={[styles.headingLineTwoAccent, { color: theme.colors.accent }]}>
                    {isSignUp ? 'Falling For' : 'Reconnect?'}
                  </Text>
                </View>
              </View>

              <Text level="body" color="secondary" style={styles.subtitle}>
                {isSignUp
                  ? 'Real people, genuine chemistry. Step into intentional dating.'
                  : 'Pick up your conversations and see who liked your profile.'}
              </Text>
            </View>

            {/* Segmented Auth Method Switcher */}
            <View
              style={[
                styles.tabSwitcher,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : theme.colors.surfaceMuted,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'phone' && [
                    styles.tabButtonActive,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : theme.colors.border,
                    },
                  ],
                ]}
                onPress={() => handleTabSwitch('phone')}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityLabel="Phone authentication tab"
              >
                <Phone
                  size={14}
                  color={
                    activeTab === 'phone' ? theme.colors.textPrimary : theme.colors.textSecondary
                  }
                  style={styles.tabIcon}
                />
                <Text
                  level="bodySmall"
                  style={{
                    fontWeight: activeTab === 'phone' ? '700' : '500',
                    color:
                      activeTab === 'phone' ? theme.colors.textPrimary : theme.colors.textSecondary,
                    fontSize: 13,
                  }}
                >
                  Phone Number
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'email' && [
                    styles.tabButtonActive,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : theme.colors.border,
                    },
                  ],
                ]}
                onPress={() => handleTabSwitch('email')}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityLabel="Email authentication tab"
              >
                <Mail
                  size={14}
                  color={
                    activeTab === 'email' ? theme.colors.textPrimary : theme.colors.textSecondary
                  }
                  style={styles.tabIcon}
                />
                <Text
                  level="bodySmall"
                  style={{
                    fontWeight: activeTab === 'email' ? '700' : '500',
                    color:
                      activeTab === 'email' ? theme.colors.textPrimary : theme.colors.textSecondary,
                    fontSize: 13,
                  }}
                >
                  Email Address
                </Text>
              </TouchableOpacity>
            </View>

            {/* Rate limit warning banner */}
            {rateLimitSeconds > 0 && (
              <View
                style={[
                  styles.rateLimitBanner,
                  { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning },
                ]}
              >
                <Clock size={15} color={theme.colors.warning} style={{ marginRight: 8 }} />
                <Text
                  level="bodySmall"
                  style={{ color: theme.colors.warning, fontWeight: '600', flex: 1, fontSize: 12.5 }}
                >
                  Too many attempts. Please wait {rateLimitSeconds}s before requesting a new code.
                </Text>
              </View>
            )}

            {/* Compact Input Section */}
            <View style={styles.inputSection}>
              {activeTab === 'phone' ? (
                <View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: errorMessage ? theme.colors.error : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Mobile Number
                  </Text>
                  <View
                    style={[
                      styles.inputCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.surface,
                        borderColor: errorMessage
                          ? theme.colors.error
                          : isInputFocused
                            ? theme.colors.accent
                            : isDark
                              ? 'rgba(255, 255, 255, 0.1)'
                              : theme.colors.border,
                        borderWidth: isInputFocused || errorMessage ? 1.5 : 1,
                      },
                    ]}
                  >
                    {/* Country Code Dropdown Button */}
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        haptics.selection();
                        setIsCountryModalVisible(true);
                      }}
                      style={styles.countryCodeDropdownButton}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Country code: ${selectedCountry.name} ${selectedCountry.dialCode}. Double tap to change country.`}
                    >
                      <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
                      <Text
                        style={[
                          styles.countryCodeText,
                          { color: theme.colors.textPrimary, fontWeight: '700' },
                        ]}
                      >
                        {selectedCountry.dialCode}
                      </Text>
                      <ChevronDown
                        size={13}
                        color={theme.colors.textSecondary}
                        style={{ marginLeft: 3, marginRight: 8 }}
                      />
                      <View
                        style={[
                          styles.badgeDivider,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : theme.colors.border,
                          },
                        ]}
                      />
                    </TouchableOpacity>

                    <RNTextInput
                      ref={phoneInputRef}
                      style={[styles.phoneTextInput, { color: theme.colors.textPrimary }]}
                      placeholder={selectedCountry.placeholder}
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formatPhoneNumber(phoneNumber)}
                      onChangeText={handlePhoneChange}
                      keyboardType="number-pad"
                      autoCorrect={false}
                      spellCheck={false}
                      keyboardAppearance={isDark ? 'dark' : 'light'}
                      maxLength={selectedCountry.maxLength + 4}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      testID="phone-input"
                    />

                    {phoneNumber.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setPhoneNumber('');
                          phoneInputRef.current?.focus();
                        }}
                        style={styles.clearButton}
                        accessibilityLabel="Clear phone number"
                      >
                        <X size={14} color={theme.colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text level="caption" color="tertiary" style={styles.helperText}>
                    We will send a 6-digit SMS verification code to this mobile number.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: errorMessage ? theme.colors.error : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Email Address
                  </Text>
                  <View
                    style={[
                      styles.inputCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.surface,
                        borderColor: errorMessage
                          ? theme.colors.error
                          : isInputFocused
                            ? theme.colors.accent
                            : isDark
                              ? 'rgba(255, 255, 255, 0.1)'
                              : theme.colors.border,
                        borderWidth: isInputFocused || errorMessage ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Mail
                      size={17}
                      color={isInputFocused ? theme.colors.accent : theme.colors.textTertiary}
                      style={{ marginRight: 10 }}
                    />
                    <RNTextInput
                      ref={emailInputRef}
                      style={[styles.emailTextInput, { color: theme.colors.textPrimary }]}
                      placeholder="name@example.com"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      keyboardAppearance={isDark ? 'dark' : 'light'}
                      returnKeyType="go"
                      enablesReturnKeyAutomatically={true}
                      onSubmitEditing={handleContinue}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      testID="email-input"
                    />

                    {email.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setEmail('');
                          emailInputRef.current?.focus();
                        }}
                        style={styles.clearButton}
                        accessibilityLabel="Clear email address"
                      >
                        <X size={14} color={theme.colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text level="caption" color="tertiary" style={styles.helperText}>
                    We will send a 6-digit confirmation code to your inbox.
                  </Text>
                </View>
              )}

              {/* Error message card */}
              {errorMessage && (
                <View
                  style={[
                    styles.errorCard,
                    { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error },
                  ]}
                >
                  <AlertCircle size={15} color={theme.colors.error} style={{ marginRight: 8 }} />
                  <Text
                    level="bodySmall"
                    style={{ color: theme.colors.error, fontWeight: '500', flex: 1, fontSize: 13 }}
                  >
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Mode switch suggestion when account exists or does not exist */}
              {suggestionMode && (
                <TouchableOpacity
                  style={[
                    styles.suggestionButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(236, 72, 153, 0.14)'
                        : 'rgba(236, 72, 153, 0.08)',
                      borderColor: theme.colors.accent,
                    },
                  ]}
                  onPress={() => {
                    haptics.impactMedium();
                    const nextMode = suggestionMode;
                    setSuggestionMode(null);
                    setErrorMessage(undefined);
                    router.setParams({ mode: nextMode });
                  }}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={
                    suggestionMode === 'signup' ? 'Switch to Sign Up' : 'Switch to Sign In'
                  }
                >
                  <Text
                    level="bodySmall"
                    style={{ color: theme.colors.accent, fontWeight: '700', textAlign: 'center' }}
                  >
                    {suggestionMode === 'signup'
                      ? '✨ New to Nazar? Tap to Create Account'
                      : '👋 Existing Account? Tap to Sign In'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Primary Action Button */}
            <View style={styles.primaryButtonWrapper}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.colors.accent,
                    opacity: rateLimitSeconds > 0 || isLoading ? 0.7 : 1,
                    shadowColor: theme.colors.accent,
                  },
                ]}
                onPress={handleContinue}
                disabled={rateLimitSeconds > 0 || isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continue to OTP verification"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.primaryButtonContent}>
                    <Text style={styles.primaryButtonText}>
                      {rateLimitSeconds > 0 ? `Wait (${rateLimitSeconds}s)` : 'Continue'}
                    </Text>
                    {rateLimitSeconds === 0 && (
                      <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.border },
                ]}
              />
              <Text level="caption" color="tertiary" style={styles.dividerText}>
                or continue with
              </Text>
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.border },
                ]}
              />
            </View>

            {/* Social Logins */}
            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.socialFullButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.colors.surface,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.border,
                  },
                ]}
                onPress={() => handleSocialAuth('google')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <GoogleIcon size={18} />
                <Text
                  style={[
                    styles.socialButtonText,
                    { color: theme.colors.textPrimary, marginLeft: 8 },
                  ]}
                >
                  Continue with Google
                </Text>
              </TouchableOpacity>

              {/* Passkey action */}
              <TouchableOpacity
                style={[
                  styles.passkeyButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.surfaceMuted,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.border,
                  },
                ]}
                onPress={() => handleSocialAuth('passkey')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  isSignUp
                    ? `Sign up with ${passkeyInfo?.label || 'Passkey'}`
                    : `Sign in with ${passkeyInfo?.label || 'Passkey'}`
                }
              >
                <PasskeyIcon size={17} color={theme.colors.textSecondary} />
                <Text
                  style={[
                    styles.passkeyText,
                    { color: theme.colors.textPrimary, marginLeft: 8 },
                  ]}
                >
                  {isSignUp
                    ? `Sign up with ${passkeyInfo?.label || 'Passkey'}`
                    : `Sign in with ${passkeyInfo?.label || 'Passkey'}`}
                </Text>
              </TouchableOpacity>

              {/* Discreet Dev Explore Pill */}
              <TouchableOpacity
                style={[
                  styles.devBypassPill,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.07)',
                    borderColor: 'rgba(16, 185, 129, 0.22)',
                  },
                ]}
                onPress={handleSkipAuth}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Explore Preview Demo Mode"
                testID="skip-auth-button"
              >
                <Sparkles size={13} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.devBypassText}>Explore Preview (Demo Mode)</Text>
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Toggle */}
            <View style={styles.modeToggleRow}>
              <Text level="bodySmall" color="secondary">
                {isSignUp ? 'Already have an account?' : 'New to Nazar?'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setErrorMessage(undefined);
                  setSuggestionMode(null);
                  router.setParams({ mode: isSignUp ? 'signin' : 'signup' });
                }}
                style={{ marginLeft: 6, paddingVertical: 4 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? 'Switch to Sign In' : 'Switch to Sign Up'}
              >
                <Text
                  level="bodySmall"
                  style={{ color: theme.colors.accent, fontWeight: '700' }}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Legal Microcopy */}
            <Text style={styles.legalNotice}>
              By continuing, you agree to our Terms of Service & Privacy Policy.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* Bottom Sheet Country Code Modal */}
      <Modal
        visible={isCountryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsCountryModalVisible(false);
          setCountrySearch('');
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setIsCountryModalVisible(false);
            setCountrySearch('');
          }}
        >
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isDark ? '#141216' : theme.colors.surface,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : theme.colors.border,
                  },
                ]}
              >
                {/* Drag Handle Indicator */}
                <View style={styles.modalHandle} />

                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    Select Country / Region
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.light();
                      setIsCountryModalVisible(false);
                      setCountrySearch('');
                    }}
                    style={[
                      styles.modalCloseButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : theme.colors.surfaceMuted,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Close country selection"
                  >
                    <X size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View
                  style={[
                    styles.modalSearchCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : theme.colors.surfaceMuted,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
                  <RNTextInput
                    ref={searchInputRef}
                    style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
                    placeholder="Search country or dial code..."
                    placeholderTextColor={theme.colors.textTertiary}
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {countrySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCountrySearch('')}>
                      <X size={14} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Country List */}
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(item) => item.code}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.countryListContent}
                  renderItem={({ item }) => {
                    const isSelected = item.code === selectedCountry.code;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.countryRow,
                          isSelected && {
                            backgroundColor: isDark
                              ? 'rgba(230, 57, 32, 0.14)'
                              : 'rgba(230, 57, 32, 0.08)',
                          },
                        ]}
                        onPress={() => {
                          haptics.selection();
                          setSelectedCountry(item);
                          setIsCountryModalVisible(false);
                          setCountrySearch('');
                          if (phoneNumber.length > item.maxLength) {
                            setPhoneNumber(phoneNumber.slice(0, item.maxLength));
                          }
                          setTimeout(() => {
                            phoneInputRef.current?.focus();
                          }, 300);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.countryRowFlag}>{item.flag}</Text>
                        <View style={styles.countryRowInfo}>
                          <Text
                            style={[
                              styles.countryRowName,
                              {
                                color: isSelected
                                  ? theme.colors.accent
                                  : theme.colors.textPrimary,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.countryRowCodeBadge,
                              { color: isSelected ? theme.colors.accent : theme.colors.textSecondary },
                            ]}
                          >
                            {item.dialCode}
                          </Text>
                        </View>
                        {isSelected && (
                          <Check size={18} color={theme.colors.accent} style={{ marginLeft: 8 }} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    zIndex: 20,
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
    elevation: 2,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 4,
  },
  headingLineOne: {
    fontSize: 28,
    lineHeight: 36,
    paddingTop: 4,
    paddingBottom: 2,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  headingLineTwoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headingLineTwoLead: {
    fontSize: 28,
    lineHeight: 36,
    paddingBottom: 2,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headingLineTwoAccent: {
    fontSize: 28,
    lineHeight: 36,
    paddingBottom: 2,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 310,
    fontSize: 13.5,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 20,
    height: 42,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabButtonActive: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabIcon: {
    marginRight: 6,
  },
  rateLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  inputSection: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  countryCodeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    paddingVertical: 6,
  },
  flagEmoji: {
    fontSize: 17,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 14.5,
  },
  badgeDivider: {
    width: 1,
    height: 20,
    marginLeft: 10,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  emailTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    marginTop: 6,
    paddingHorizontal: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  primaryButtonWrapper: {
    marginTop: 2,
    marginBottom: 18,
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  socialButtonsContainer: {
    gap: 10,
  },
  socialFullButton: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passkeyButton: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passkeyText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  devBypassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
  },
  devBypassText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  legalNotice: {
    color: '#71717A',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  suggestionButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform?.OS === 'ios' ? 36 : 28,
    maxHeight: '82%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 0,
  },
  countryListContent: {
    paddingBottom: 24,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  countryRowFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  countryRowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryRowName: {
    fontSize: 15,
  },
  countryRowCodeBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
});
