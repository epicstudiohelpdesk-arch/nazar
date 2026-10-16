import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ProfileCompleteness, ProfileVisibility } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Badge } from '../../design/primitives/Badge.js';
import { Icon } from '../../design/primitives/Icon.js';

interface CompletenessCardProps {
  completeness: ProfileCompleteness;
  visibility: ProfileVisibility;
}

export const CompletenessCard: React.FC<CompletenessCardProps> = ({ completeness, visibility }) => {
  const { theme } = useTheme();
  const isComplete = completeness.missingRequired.length === 0;

  const getVisibilityBadge = () => {
    switch (visibility) {
      case 'ACTIVE':
        return <Badge variant="success" label="Active in Discovery" size="sm" icon="checkCircle" />;
      case 'DRAFT':
        return <Badge variant="warning" label="Draft Mode" size="sm" icon="alertCircle" />;
      case 'PAUSED':
        return <Badge variant="neutral" label="Paused" size="sm" />;
      case 'HIDDEN':
        return <Badge variant="error" label="Hidden" size="sm" icon="eyeOff" />;
      default:
        return <Badge variant="neutral" label={visibility} size="sm" />;
    }
  };

  return (
    <SurfaceCard elevation="sm" style={styles.card}>
      <View style={styles.headerRow}>
        <Heading level="h3">Profile Status</Heading>
        {getVisibilityBadge()}
      </View>

      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(100, Math.max(0, completeness.percentage))}%`,
                backgroundColor: isComplete ? (theme.colors.success || '#10B981') : theme.colors.accent,
              },
            ]}
          />
        </View>
        <Text level="bodySmall" color="secondary" style={styles.percentageText}>
          {completeness.percentage}% Complete
        </Text>
      </View>

      {!isComplete && (
        <View style={[styles.missingContainer, { borderTopColor: theme.colors.border }]}>
          <View style={styles.missingHeaderRow}>
            <Icon name="alertCircle" size="tiny" color={theme.colors.warning} />
            <Text level="caption" weight="bold" style={{ color: theme.colors.warning, marginLeft: 4 }}>
              Required for discovery activation:
            </Text>
          </View>
          {completeness.missingRequired.map((field) => (
            <Text key={field} level="caption" color="secondary" style={styles.missingItem}>
              • {field}
            </Text>
          ))}
        </View>
      )}

      {isComplete && visibility === 'DRAFT' && (
        <View style={styles.readyRow}>
          <Icon name="checkCircle" size="sm" color={theme.colors.success || '#10B981'} />
          <Text
            level="bodySmall"
            weight="semibold"
            style={{ color: theme.colors.success || '#10B981', marginLeft: 6 }}
          >
            Your profile is ready for discovery activation!
          </Text>
        </View>
      )}
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressContainer: {
    marginVertical: 4,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    marginTop: 8,
    fontWeight: '600',
  },
  missingContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  missingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  missingItem: {
    marginLeft: 6,
    marginTop: 3,
    lineHeight: 18,
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
  },
});
