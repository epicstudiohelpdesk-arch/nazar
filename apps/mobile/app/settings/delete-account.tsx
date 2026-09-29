import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function DeleteAccountRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const authClient = getDefaultAuthClient();

  const handlePermanentDelete = () => {
    Alert.alert(
      'Permanent Account Deletion',
      'This action cannot be undone. All your matches, chat conversations, photos, and preferences will be permanently wiped from Nazar servers immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await authClient.deleteAccount();
              Alert.alert('Account Purged', 'Your account has been deleted.', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(auth)/welcome'),
                },
              ]);
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
      <TopNavHeader
        title="Delete Account"
        onBack={() => router.back()}
        leftAction="back"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Heading level="h1" color="error">Delete Your Account</Heading>
          <Text level="body" color="secondary">
            We're sorry to see you go. Please review what happens when your account is deleted.
          </Text>
        </View>

        <SurfaceCard elevation="sm" style={styles.card}>
          <Text level="title" color="error">What will be permanently deleted:</Text>
          <Text level="bodySmall" color="secondary">• All active matches and ongoing chat conversations.</Text>
          <Text level="bodySmall" color="secondary">• All uploaded profile photos and personality prompts.</Text>
          <Text level="bodySmall" color="secondary">• Your verification status and community memberships.</Text>
          <Text level="bodySmall" color="secondary">• All authentication tokens and active session devices.</Text>
        </SurfaceCard>

        <View style={styles.actionWrapper}>
          <Button
            variant="destructive"
            size="lg"
            fullWidth
            isLoading={isDeleting}
            onPress={handlePermanentDelete}
            accessibilityLabel="Permanently delete account"
          >
            Delete Account Permanently
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
  },
  header: {
    gap: 8,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  actionWrapper: {
    marginTop: 20,
    gap: 12,
  },
});
