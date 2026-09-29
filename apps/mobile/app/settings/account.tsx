import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@platform/ui';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function AccountSettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your Nazar account? This action is permanent. Your profile will be removed from discovery and all active sessions will be terminated immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await authClient.deleteAccount();
              Alert.alert(
                'Account Deleted',
                'Your account has been scheduled for permanent deletion.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to delete account';
              Alert.alert('Error', msg);
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await authClient.logout();
      router.replace('/');
    } catch {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Account & Privacy</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance & Legal</Text>
          <View style={styles.card}>
            <Text style={styles.legalItem}>• Privacy Policy (GDPR / CCPA Compliant)</Text>
            <Text style={styles.legalItem}>• Terms of Service (18+ Requirement)</Text>
            <Text style={styles.legalItem}>• Community & Safety Guidelines</Text>
            <Text style={styles.legalSubtext}>
              All user data is encrypted in transit and at rest. Precise location coordinates are
              never shared with other users.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out of account"
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete account"
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.neutral[50]} size="small" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.warningText}>
            Deleting your account immediately revokes all active devices, hides your profile from
            matches, and marks data for permanent purging.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as '500',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.neutral[800],
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.xs,
  },
  legalItem: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  legalSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  logoutButton: {
    backgroundColor: colors.neutral[200],
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoutButtonText: {
    color: colors.neutral[800],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  deleteButton: {
    backgroundColor: colors.status.error,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.neutral[50],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as '700',
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
