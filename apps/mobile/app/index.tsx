import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@platform/ui';

export default function IndexScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nazar Platform</Text>
      <Text style={styles.subtitle}>
        Dating & Spatial Social Discovery (Release Candidate v1.0.0)
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/discovery')}
          accessibilityRole="button"
          accessibilityLabel="Go to discovery feed"
        >
          <Text style={styles.primaryButtonText}>Start Discovery ✨</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/welcome')}
          accessibilityRole="button"
          accessibilityLabel="Go to welcome landing"
        >
          <Text style={styles.secondaryButtonText}>Welcome / Sign Up 🚀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(onboarding)/profile-setup')}
          accessibilityRole="button"
          accessibilityLabel="Go to onboarding flow"
        >
          <Text style={styles.secondaryButtonText}>Onboarding Flow 📝</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/matches')}
          accessibilityRole="button"
          accessibilityLabel="Go to matches"
        >
          <Text style={styles.secondaryButtonText}>View Matches 💕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/conversations')}
          accessibilityRole="button"
          accessibilityLabel="Go to messages"
        >
          <Text style={styles.secondaryButtonText}>Open Messages 💌</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/explore')}
          accessibilityRole="button"
          accessibilityLabel="Go to explore"
        >
          <Text style={styles.secondaryButtonText}>Explore / Communities 🌍</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Go to my profile"
        >
          <Text style={styles.secondaryButtonText}>My Profile 👤</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/billing')}
          accessibilityRole="button"
          accessibilityLabel="Go to billing"
        >
          <Text style={styles.secondaryButtonText}>Billing & Premium 👑</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Go to notifications"
        >
          <Text style={styles.secondaryButtonText}>Notifications 🔔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Go to settings hub"
        >
          <Text style={styles.secondaryButtonText}>Settings Hub ⚙️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: '#FDF0EC', borderColor: '#D84315', borderWidth: 1 }]}
          onPress={() => router.push('/design-system-showcase')}
          accessibilityRole="button"
          accessibilityLabel="Go to design system showcase"
        >
          <Text style={[styles.secondaryButtonText, { color: '#D84315' }]}>Design System QA 🎨</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    paddingVertical: 48,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.neutral[50],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  secondaryButton: {
    backgroundColor: colors.neutral[200],
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.neutral[800],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
});
