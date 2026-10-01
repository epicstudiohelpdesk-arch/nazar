import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { OtpInput } from '../../src/design/components/input/OtpInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthService } from '../../src/auth/auth-service.js';
import { getDefaultSessionService } from '../../src/auth/session-service.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function OtpVerificationScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const authService = getDefaultAuthService();
  const sessionService = getDefaultSessionService();

  const { authMethod, pendingIdentifier } = useOnboardingStore();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState<number>(45);

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
      // E.g. +919876543210 -> +91 98765 •••••
      const clean = val.replace(/\s+/g, '');
      if (clean.length >= 10) {
        return `${clean.slice(0, 8)} •••••`;
      }
      return val;
    }
    // E.g. priya@example.com -> p••••@example.com
    const parts = val.split('@');
    const userPart = parts[0];
    const domainPart = parts[1];
    if (parts.length === 2 && userPart && domainPart && userPart.length > 1) {
      return `${userPart[0]}•••••@${domainPart}`;
    }
    return val;
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    const targetIdentifier = pendingIdentifier || '+919999999999';

    const result =
      authMethod === 'phone'
        ? await authService.verifyPhoneOtp(targetIdentifier, code)
        : await authService.verifyEmail(targetIdentifier, code);

    if (!result.success) {
      setIsLoading(false);
      setErrorMessage(result.error);
      return;
    }

    // Restore session and query authoritative profile completeness
    const sessionResult = await sessionService.restoreSession();
    setIsLoading(false);

    if (sessionResult.status === 'ACTIVE') {
      trackOnboardingEvent('discovery_entered', { source: 'returning_user' });
      router.replace('/(tabs)/discovery');
      return;
    }

    // Incomplete profile or new user -> resume exact missing onboarding step
    const nextStep = sessionResult.nextStep || 'intro';
    trackOnboardingEvent('profile_started', { resumeStep: nextStep });

    const stepRoutes: Record<string, `/(onboarding)/${string}`> = {
      'profile-setup': '/(onboarding)/profile-setup',
      'photos': '/(onboarding)/photos',
      'interests': '/(onboarding)/interests',
      'prompts': '/(onboarding)/prompts',
      'preferences': '/(onboarding)/preferences',
      'permissions': '/(onboarding)/permissions',
      'preview': '/(onboarding)/preview',
    };
    const route = stepRoutes[nextStep] || '/(onboarding)/intro';
    router.replace(route);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setErrorMessage(undefined);
    const targetIdentifier = pendingIdentifier || '+919999999999';

    const res =
      authMethod === 'phone'
        ? await authService.requestPhoneOtp(targetIdentifier)
        : await authService.requestEmailVerification(targetIdentifier);

    if (res.success) {
      setResendCooldown(45);
    } else {
      if (res.isRateLimited) {
        setResendCooldown(res.retryAfterSeconds || 60);
      }
      setErrorMessage(res.error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title=""
        onBack={() => router.back()}
        leftAction="back"
      />

      <View style={styles.content}>
        <View style={styles.formHeader}>
          <Heading level="h1">Verify your identity</Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            Enter the 6-digit code sent to{' '}
            <Text level="body" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
              {formatDestination(pendingIdentifier)}
            </Text>
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.changeAction}
            accessibilityRole="button"
            accessibilityLabel="Change phone number or email"
          >
            <Text level="bodySmall" style={{ color: theme.colors.accent, fontWeight: '600' }}>
              Wrong {authMethod === 'phone' ? 'number' : 'email'}? Change
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <OtpInput
            length={6}
            value={code}
            onChangeCode={(val) => {
              setCode(val);
              if (errorMessage) setErrorMessage(undefined);
            }}
            errorMessage={errorMessage}
          />

          <View style={styles.resendWrapper}>
            {resendCooldown > 0 ? (
              <Text level="bodySmall" color="tertiary">
                Resend code in {resendCooldown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                accessibilityRole="button"
                accessibilityLabel="Resend verification code"
              >
                <Text level="bodySmall" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  Didn't get a code? Resend Code
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            onPress={handleVerify}
            accessibilityLabel="Verify code and continue"
          >
            Verify & Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 36,
  },
  formHeader: {
    marginTop: 16,
    gap: 8,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 22,
  },
  changeAction: {
    marginTop: 4,
  },
  inputContainer: {
    marginVertical: 32,
    alignItems: 'center',
    gap: 20,
  },
  resendWrapper: {
    marginTop: 12,
    alignItems: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
});
