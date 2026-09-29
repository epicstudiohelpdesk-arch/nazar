import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Badge } from '../../primitives/Badge.js';
import { Button } from '../button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export interface SubscriptionCardProps {
  readonly id: string;
  readonly tierName: string; // e.g. "Nazar Gold"
  readonly priceFormatted: string; // e.g. "₹799"
  readonly interval: string; // e.g. "per month"
  readonly badge?: string; // e.g. "Most Popular"
  readonly features: readonly string[];
  readonly isCurrentPlan?: boolean;
  readonly onUpgrade?: () => void;
  readonly isPopular?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  id,
  tierName,
  priceFormatted,
  interval,
  badge,
  features,
  isCurrentPlan = false,
  onUpgrade,
  isPopular = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <SurfaceCard
      p="lg"
      radius="radiusXL"
      elevationLevel={isPopular ? 'shadowMD' : 'shadowSM'}
      borderColor={isPopular ? colors.accent : colors.border}
      border={true}
      style={[
        styles.card,
        {
          backgroundColor: isPopular ? colors.surface : colors.surfaceMuted,
        },
        style,
      ]}
      testID={testID || `subscription-card-${id}`}
    >
      <View style={styles.headerRow}>
        <View>
          <Heading level="h3">{tierName}</Heading>
          {badge && (
            <Badge
              label={badge}
              variant={isPopular ? 'gold' : 'neutral'}
              size="sm"
              style={{ marginTop: 4 }}
            />
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="heading2" weight="bold" style={{ color: colors.textPrimary }}>
            {priceFormatted}
          </Text>
          <Text variant="caption" style={{ color: colors.textTertiary }}>
            {interval}
          </Text>
        </View>
      </View>

      {/* Feature Bullet Points */}
      <View style={[styles.featuresList, { marginVertical: spacing.md }]}>
        {features.map((feature, idx) => (
          <View key={idx} style={styles.featureRow}>
            <View
              style={[
                styles.checkCircle,
                { backgroundColor: colors.accentSoft, borderRadius: radii.radiusFull },
              ]}
            >
              <Icon name="check" size="tiny" color={colors.accentStrong} />
            </View>
            <Text variant="bodySmall" style={{ color: colors.textPrimary, flex: 1, marginLeft: 8 }}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      {/* Action Button */}
      {onUpgrade && (
        <Button
          label={isCurrentPlan ? 'Current Plan' : `Upgrade to ${tierName}`}
          variant={isPopular ? 'primary' : 'secondary'}
          fullWidth={true}
          disabled={isCurrentPlan}
          onPress={onUpgrade}
        />
      )}
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuresList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
