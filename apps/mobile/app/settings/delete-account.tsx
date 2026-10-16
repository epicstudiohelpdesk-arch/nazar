import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';
import { purgeDeletedAccount } from '../../src/auth/session-service.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function DeleteAccountRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const authClient = getDefaultAuthClient();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const handlePermanentDelete = () => {
    haptics.notificationError();
    Alert.alert(
      'Permanent Account Deletion',
      'This action is irreversible. All your matches, chat conversations, photos, preferences, and profile data will be permanently wiped immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            trackOnboardingEvent('account_deletion_started');
            try {
              await purgeDeletedAccount(queryClient, authClient);
              haptics.notificationSuccess();
              trackOnboardingEvent('account_deleted');
              Alert.alert(
                'Account Purged',
                'Your account and all associated data have been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(auth)/welcome'),
                  },
                ]
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Deletion failed';
              Alert.alert('Error', msg);
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Delete Account" onBack={() => router.back()} leftAction="back" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.warningCircle,
              { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error },
            ]}
          >
            <Icon name="warning" size={28} color={theme.colors.error} />
          </View>
          <Heading level="h1" color="error">
            Delete Your Account
          </Heading>
          <Text level="body" color="secondary">
            We're sorry to see you go. Please review what happens when your account is deleted.
          </Text>
        </View>

        <SurfaceCard elevation="sm" style={styles.card}>
          <Text level="title" color="error">
            What will be permanently wiped:
          </Text>
          <Text level="bodySmall" color="secondary">
            • All active matches and ongoing chat conversations.
          </Text>
          <Text level="bodySmall" color="secondary">
            • All uploaded profile photos, media items, and prompts.
          </Text>
          <Text level="bodySmall" color="secondary">
            • Your verification status and community memberships.
          </Text>
          <Text level="bodySmall" color="secondary">
            • All active devices, sessions, and push notification tokens.
          </Text>
        </SurfaceCard>

        <View style={styles.confirmationSection}>
          <Text level="title">Confirm Permanent Deletion</Text>
          <Text level="bodySmall" color="secondary">
            To prevent accidental deletion, please type{' '}
            <Text level="bodySmall" weight="bold">
              DELETE
            </Text>{' '}
            below:
          </Text>
          <TextInput
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.actionWrapper}>
          <Button
            variant="destructive"
            size="lg"
            fullWidth
            disabled={!isConfirmed || isDeleting}
            isLoading={isDeleting}
            onPress={handlePermanentDelete}
            accessibilityLabel="Permanently delete account"
          >
            Permanently Delete Account
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.back()}
            accessibilityLabel="Cancel and keep account"
          >
            Keep My Account
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
  content: {
    padding: 24,
    gap: 24,
    paddingBottom: 48,
  },
  header: {
    gap: 8,
    alignItems: 'center',
  },
  warningCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  confirmationSection: {
    gap: 10,
  },
  actionWrapper: {
    marginTop: 12,
    gap: 12,
  },
});
