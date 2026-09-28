import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';

export default function IndexScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nazar Discovery Platform</Text>
      <Text style={styles.subtitle}>Mobile Application Shell (Gate 01)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
});
