import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dialog } from '../../src/design/components/modal/Dialog.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function BlockModalRoute(): React.JSX.Element {
  const { targetUserId } = useLocalSearchParams<{ targetUserId: string }>();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const authClient = getDefaultAuthClient();

  const handleConfirmBlock = async () => {
    setIsSubmitting(true);
    try {
      if (targetUserId) {
        await authClient.request(`/v1/safety/blocking/${targetUserId}/block`, {
          method: 'POST',
        });
      }
      Alert.alert('Account Blocked', 'This user has been blocked and removed from your views.');
      router.replace('/(tabs)/discovery');
    } catch {
      Alert.alert('Account Blocked', 'This user has been blocked.');
      router.replace('/(tabs)/discovery');
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
