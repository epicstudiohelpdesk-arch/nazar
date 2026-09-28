import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ProfileCompleteness, ProfileVisibility } from '@platform/api-contracts';

interface CompletenessCardProps {
  completeness: ProfileCompleteness;
  visibility: ProfileVisibility;
}

const statusColors: Record<ProfileVisibility, { backgroundColor: string }> = {
  ACTIVE: { backgroundColor: '#DCFCE7' },
  DRAFT: { backgroundColor: '#FEF9C3' },
  PAUSED: { backgroundColor: '#F3F4F6' },
  HIDDEN: { backgroundColor: '#FEE2E2' },
};

export const CompletenessCard: React.FC<CompletenessCardProps> = ({ completeness, visibility }) => {
  const isComplete = completeness.missingRequired.length === 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Profile Status</Text>
        <View style={[styles.badge, statusColors[visibility]]}>
          <Text style={styles.badgeText}>{visibility}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, completeness.percentage))}%` },
            ]}
          />
        </View>
        <Text style={styles.percentageText}>{completeness.percentage}% Complete</Text>
      </View>

      {!isComplete && (
        <View style={styles.missingContainer}>
          <Text style={styles.missingTitle}>Required for activation:</Text>
          {completeness.missingRequired.map((field) => (
            <Text key={field} style={styles.missingItem}>
              • {field}
            </Text>
          ))}
        </View>
      )}

      {isComplete && visibility === 'DRAFT' && (
        <Text style={styles.readyText}>✓ Your profile is ready for discovery activation!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  status_ACTIVE: {
    backgroundColor: '#DCFCE7',
  },
  status_DRAFT: {
    backgroundColor: '#FEF9C3',
  },
  status_PAUSED: {
    backgroundColor: '#F3F4F6',
  },
  status_HIDDEN: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E11D48',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
  missingContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  missingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
    marginBottom: 4,
  },
  missingItem: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  readyText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginTop: 8,
  },
});
