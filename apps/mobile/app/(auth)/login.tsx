import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthService } from '../../src/auth/auth-service.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const authService = getDefaultAuthService();

  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  const { setAuthIdentifier } = useOnboardingStore();

  useEffect(() => {
    trackOnboardingEvent('auth_started', { defaultMethod: 'phone' });
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Clean phone input (numbers only, max 10 digits for Indian mobile)
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setPhoneNumber(cleaned);
    if (errorMessage) setErrorMessage(undefined);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text.trim());
    if (errorMessage) setErrorMessage(undefined);
  };

  const formatPhoneNumber = (num: string): string => {
    if (num.length > 5) {
      return `${num.slice(0, 5)} ${num.slice(5)}`;
    }
    return num;
  };

  const handleContinue = async () => {
    if (rateLimitSeconds > 0) return;

    if (activeTab === 'phone') {
      if (phoneNumber.length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(undefined);

      const fullPhone = `+91${phoneNumber}`;
      setAuthIdentifier('phone', fullPhone);

      const result = await authService.requestPhoneOtp(fullPhone);
      setIsLoading(false);

      if (result.success) {
        router.push('/(auth)/otp');
      } else {
        if (result.isRateLimited) {
          setRateLimitSeconds(result.retryAfterSeconds || 60);
        }
        setErrorMessage(result.error);
      }
    } else {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(undefined);

      setAuthIdentifier('email', email);

      const result = await authService.requestEmailVerification(email);
      setIsLoading(false);

      if (result.success) {
        router.push('/(auth)/otp');
      } else {
        if (result.isRateLimited) {
          setRateLimitSeconds(result.retryAfterSeconds || 60);
        }
        setErrorMessage(result.error);
      }
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple' | 'passkey') => {
    setErrorMessage(undefined);
    setIsLoading(true);

    if (provider === 'passkey') {
      const optionsRes = await authService.getPasskeyLoginOptions(
        activeTab === 'phone' ? `+91${phoneNumber}` : email
      );
      if (!optionsRes.success) {
        setErrorMessage(optionsRes.error || 'Passkey authentication is not available on this device.');
        setIsLoading(false);
        return;
      }
      // Note: On physical devices, WebAuthn client creates assertion challenge.
      setIsLoading(false);
      return;
    }

    // Google / Apple OAuth placeholders adhering to backend contract
    setIsLoading(false);
    setErrorMessage(`${provider === 'google' ? 'Google' : 'Apple'} Sign-In is configured for native releases.`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <Heading level="h1">Welcome to Nazar</Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Enter your details to sign in or create an account. No password needed.
          </Text>
        </View>

        {/* Auth Method Switcher */}
        <View
          style={[
            styles.tabSwitcher,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'phone' && [
                styles.tabButtonActive,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => {
              setActiveTab('phone');
              setErrorMessage(undefined);
            }}
            accessibilityRole="tab"
            accessibilityLabel="Phone authentication tab"
          >
            <Text
              level="bodySmall"
              style={{
                fontWeight: activeTab === 'phone' ? '700' : '500',
                color: activeTab === 'phone' ? theme.colors.textPrimary : theme.colors.textSecondary,
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
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => {
              setActiveTab('email');
              setErrorMessage(undefined);
            }}
            accessibilityRole="tab"
            accessibilityLabel="Email authentication tab"
          >
            <Text
              level="bodySmall"
              style={{
                fontWeight: activeTab === 'email' ? '700' : '500',
                color: activeTab === 'email' ? theme.colors.textPrimary : theme.colors.textSecondary,
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
              styles.banner,
              { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning },
            ]}
          >
            <Text level="bodySmall" style={{ color: theme.colors.warning, fontWeight: '600' }}>
              Too many attempts. Please wait {rateLimitSeconds}s before requesting a new code.
            </Text>
          </View>
        )}

        {/* Input section */}
        <View style={styles.inputContainer}>
          {activeTab === 'phone' ? (
            <View>
              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.countryBadge,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text level="body" style={{ fontWeight: '600', color: theme.colors.textPrimary }}>
                    🇮🇳 +91
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Mobile Number"
                    placeholder="98765 43210"
                    value={formatPhoneNumber(phoneNumber)}
                    onChangeText={handlePhoneChange}
                    keyboardType="number-pad"
                    maxLength={11}
                    errorMessage={errorMessage}
                    testID="phone-input"
                  />
                </View>
              </View>
              <Text level="caption" color="tertiary" style={{ marginTop: 6 }}>
                We will send a 6-digit SMS verification code to this number.
              </Text>
            </View>
          ) : (
            <View>
              <TextInput
                label="Email Address"
                placeholder="priya@example.com"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                errorMessage={errorMessage}
                testID="email-input"
              />
              <Text level="caption" color="tertiary" style={{ marginTop: 6 }}>
                We will send a 6-digit confirmation code to your inbox.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={rateLimitSeconds > 0}
            onPress={handleContinue}
            accessibilityLabel="Continue to OTP verification"
          >
            {rateLimitSeconds > 0 ? `Wait (${rateLimitSeconds}s)` : 'Continue'}
          </Button>
        </View>

        {/* Social / Alternate Auth Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text level="caption" color="tertiary" style={styles.dividerText}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Social and Passkey actions */}
        <View style={styles.socialButtonsContainer}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => handleSocialAuth('google')}
            accessibilityLabel="Continue with Google"
          >
            Google
          </Button>

          <Button
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => handleSocialAuth('apple')}
            accessibilityLabel="Continue with Apple"
          >
            Apple
          </Button>

          <Button
            variant="tertiary"
            size="md"
            fullWidth
            onPress={() => handleSocialAuth('passkey')}
            accessibilityLabel="Sign in with Passkey"
          >
            Sign in with Passkey 🔑
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formHeader: {
    marginTop: 16,
    gap: 8,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 22,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginTop: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  banner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputContainer: {
    marginTop: 24,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  countryBadge: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22, // Align with text input field
  },
  buttonWrapper: {
    marginTop: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
  },
  socialButtonsContainer: {
    gap: 12,
  },
});
