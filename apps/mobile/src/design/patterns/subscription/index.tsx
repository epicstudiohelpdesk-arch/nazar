import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Button } from '../../components/button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- BENEFIT ROW ---
export interface BenefitRowProps {
  readonly title: string;
  readonly description?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const BenefitRow: React.FC<BenefitRowProps> = ({ title, description, style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.benefitRow, style]}>
      <View style={[styles.checkCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon name="check" size="tiny" color={colors.accent} strokeWidth={2.5} />
      </View>
      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
        <Text variant="bodySmall" weight="semibold" style={{ color: colors.textPrimary }}>
          {title}
        </Text>
        {description && (
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 1 }}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
};

// --- ENTITLEMENT BADGE ---
export interface EntitlementBadgeProps {
  readonly tier?: 'gold' | 'platinum' | 'free';
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const EntitlementBadge: React.FC<EntitlementBadgeProps> = ({
  tier = 'gold',
  label,
  style,
}) => {
  const { radii } = useTheme();
  const isGold = tier === 'gold';
  const displayLabel = label || (isGold ? 'NAZAR GOLD' : tier.toUpperCase());

  return (
    <View
      style={[
        styles.entitlementBadge,
        {
          backgroundColor: isGold ? '#FEF3C7' : '#E5E7EB',
          borderColor: isGold ? '#F59E0B' : '#9CA3AF',
          borderRadius: radii.radiusFull,
        },
        style,
      ]}
    >
      <Icon
        name={isGold ? 'sparkles' : 'shield'}
        size="tiny"
        color={isGold ? '#D97706' : '#4B5563'}
        style={{ marginRight: 4 }}
      />
      <Text
        variant="caption"
        weight="bold"
        style={{ color: isGold ? '#B45309' : '#374151', fontSize: 10 }}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

// --- PURCHASE BUTTON ---
export interface PurchaseButtonProps {
  readonly price: string;
  readonly period?: string;
  readonly onPress: () => void;
  readonly isLoading?: boolean;
  readonly disabled?: boolean;
}

export const PurchaseButton: React.FC<PurchaseButtonProps> = ({
  price,
  period = '/month',
  onPress,
  isLoading = false,
  disabled = false,
}) => {
  return (
    <Button
      label={`Continue · ${price}${period}`}
      variant="primary"
      size="lg"
      fullWidth
      onPress={onPress}
      isLoading={isLoading}
      disabled={disabled}
    />
  );
};

// --- RESTORE PURCHASES BUTTON ---
export const RestorePurchasesButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.restoreBtn}
      accessibilityRole="button"
      accessibilityLabel="Restore existing purchases"
    >
      <Text variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
        Restore Purchases
      </Text>
    </TouchableOpacity>
  );
};

// --- SUBSCRIPTION STATUS ---
export interface SubscriptionStatusProps {
  readonly tierName: string;
  readonly expiryDate?: string;
  readonly isActive: boolean;
  readonly onManage?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  tierName,
  expiryDate,
  isActive,
  onManage,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <SurfaceCard p="md" radius="radiusLG" style={style}>
      <View style={styles.statusHeader}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            Current Membership
          </Text>
          <Heading level="h3" style={{ marginTop: 2 }}>
            {tierName}
          </Heading>
          {expiryDate && (
            <Text variant="caption" style={{ color: colors.textTertiary, marginTop: 2 }}>
              {isActive ? `Renews on ${expiryDate}` : `Expired on ${expiryDate}`}
            </Text>
          )}
        </View>

        {onManage && <Button label="Manage" variant="secondary" size="sm" onPress={onManage} />}
      </View>
    </SurfaceCard>
  );
};

// --- PLAN CARD ---
export interface PlanCardProps {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly isPopular?: boolean;
  readonly isSelected?: boolean;
  readonly benefits: readonly string[];
  readonly onSelect: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  name,
  price,
  period,
  isPopular = false,
  isSelected = false,
  benefits,
  onSelect,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <SurfaceCard
      p="lg"
      radius="radiusXL"
      elevationLevel={isSelected ? 'shadowMD' : 'shadowSM'}
      onPress={onSelect}
      style={[
        styles.planCard,
        {
          borderColor: isSelected ? colors.accent : colors.border,
          borderWidth: isSelected ? 2 : 1,
        },
        style,
      ]}
    >
      {isPopular && (
        <View
          style={[
            styles.popularBadge,
            { backgroundColor: colors.accent, borderRadius: radii.radiusFull },
          ]}
        >
          <Text variant="caption" weight="bold" style={{ color: '#FFFFFF', fontSize: 10 }}>
            MOST POPULAR
          </Text>
        </View>
      )}

      <Text variant="title" weight="bold" style={{ color: colors.textPrimary }}>
        {name}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginVertical: spacing.xs }}>
        <Text variant="display" weight="bold" style={{ color: colors.accent }}>
          {price}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 4 }}>
          /{period}
        </Text>
      </View>

      <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
        {benefits.map((b, idx) => (
          <BenefitRow key={idx} title={b} />
        ))}
      </View>
    </SurfaceCard>
  );
};

export const PricingTierCard = PlanCard;

const styles = StyleSheet.create({
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entitlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  restoreBtn: {
    alignSelf: 'center',
    padding: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCard: {
    width: '100%',
    position: 'relative',
    marginVertical: 6,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
