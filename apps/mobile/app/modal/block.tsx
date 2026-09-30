import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../src/design/components/modal/Dialog.js';
import { getDefaultSafetyApi, invalidateSafetyCaches } from '../../src/safety/safety-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function BlockModalRoute(): React.JSX.Element {
  const { targetUserId } = useLocalSearchParams<{ targetUserId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const safetyApi = getDefaultSafetyApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmBlock = async () => {
    if (!targetUserId) {
      router.back();
      return;
    }

    setIsSubmitting(true);
    try {
      await safetyApi.blockUser(targetUserId, {
        reason: 'Blocked via mobile safety action',
      });

      trackOnboardingEvent('block_completed', { targetUserId });

      // Invalidate discovery, matches, messaging, and blocks cache
      invalidateSafetyCaches(queryClient);

      Alert.alert(
        'Account Blocked',
        'This user has been blocked. They will no longer appear in your feeds, searches, or messages.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/discovery') }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to block user';
      Alert.alert('Action Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Dialog
        visible={true}
        variant="destructive"
        title="Block this member?"
        message="They will no longer be able to view your profile, send messages, or see you in discovery feeds. You can unblock anytime from Settings."
        confirmLabel="Block Account"
        cancelLabel="Cancel"
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmBlock}
        onCancel={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
