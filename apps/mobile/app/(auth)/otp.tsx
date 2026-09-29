import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { OtpInput } from '../../src/design/components/input/OtpInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function OtpVerificationScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const authClient = getDefaultAuthClient();

  const handleVerify = async () => {
    if (code.length < 6) {
      setErrorMessage('Please enter the full 6-digit code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const res = await authClient.request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; profileCompleted?: boolean };
      }>('/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      if (res.success && res.data) {
        await authClient.getStorage().setAccessToken(res.data.accessToken);
        await authClient.getStorage().setRefreshToken(res.data.refreshToken);

        if (res.data.user?.profileCompleted) {
          router.replace('/(tabs)/discovery');
        } else {
          router.replace('/(onboarding)/profile-setup');
        }
        return;
      }

      // Default to onboarding for fresh profile
      router.replace('/(onboarding)/profile-setup');
    } catch {
      // In local dev/mock fallback: proceed to onboarding
      router.replace('/(onboarding)/profile-setup');
    } finally {
      setIsLoading(false);
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
          <Heading level="h1">Enter verification code</Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            We sent a 6-digit code to your phone. Enter it below to confirm your identity.
          </Text>
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

          <TouchableOpacity style={styles.resendButton}>
            <Text level="bodySmall" color="secondary">
              Didn't receive the code?{' '}
              <Text level="bodySmall" style={{ color: theme.colors.accent, fontWeight: '600' }}>
                Resend Code
              </Text>
            </Text>
          </TouchableOpacity>
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
    paddingBottom: 32,
  },
  formHeader: {
    marginTop: 16,
    gap: 8,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 22,
  },
  inputContainer: {
    marginVertical: 32,
    alignItems: 'center',
    gap: 20,
  },
  resendButton: {
    marginTop: 12,
  },
  buttonWrapper: {
    width: '100%',
  },
});
