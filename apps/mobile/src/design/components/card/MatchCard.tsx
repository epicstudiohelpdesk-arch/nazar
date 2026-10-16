import React, { useEffect, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Avatar } from '../../primitives/Avatar.js';
import { Icon } from '../../primitives/Icon.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

function formatTimeRemaining(expiresAt?: string | null): { text: string; isExpired: boolean } {
  if (!expiresAt) return { text: '', isExpired: false };
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return { text: '', isExpired: false };
  const now = Date.now();
  const diffMs = exp - now;
  if (diffMs <= 0) return { text: 'Expired', isExpired: true };
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0 && mins > 0) return { text: `${hours}h ${mins}m left`, isExpired: false };
  if (hours > 0) return { text: `${hours}h left`, isExpired: false };
  return { text: `${mins}m left`, isExpired: false };
}

export interface MatchCardProps {
  readonly id: string;
  readonly name: string;
  readonly age?: number;
  readonly avatarUrl?: string | null;
  readonly matchedAt?: string;
  readonly compatibilityScore?: number; // e.g. 94%
  readonly isNew?: boolean;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
  readonly expiresAt?: string | null;
  readonly status?: string;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  id,
  name,
  age,
  avatarUrl,
  matchedAt,
  compatibilityScore,
  isNew = false,
  onPress,
  style,
  testID,
  expiresAt,
  status,
}) => {
  const { colors, radii } = useTheme();
  const [expiry, setExpiry] = useState(formatTimeRemaining(expiresAt));

  useEffect(() => {
    setExpiry(formatTimeRemaining(expiresAt));
    if (!expiresAt) return;
    const exp = new Date(expiresAt).getTime();
    if (Number.isNaN(exp)) return;
    const tick = setInterval(() => {
      setExpiry(formatTimeRemaining(expiresAt));
    }, 60000); // update every minute
    return () => clearInterval(tick);
  }, [expiresAt]);

  return (
    <SurfaceCard
      p="sm"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `match-card-${id}`}
      accessibilityLabel={`Match with ${name}`}
    >
      <View style={styles.contentRow}>
        <View style={styles.avatarWrapper}>
          <Avatar uri={avatarUrl} name={name} size="medium" />
          {isNew && (
            <View
              style={[
                styles.newDot,
                { backgroundColor: colors.accent, borderColor: colors.surface },
              ]}
            />
          )}
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {name}
              {age ? `, ${age}` : ''}
            </Text>
            {compatibilityScore !== undefined && (
              <View
                style={[
                  styles.sparkBadge,
                  {
                    backgroundColor: colors.accentSoft,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Icon
                  name="sparkles"
                  size="tiny"
                  color={colors.accent}
                  style={{ marginRight: 3 }}
                />
                <Text variant="caption" weight="bold" style={{ color: colors.accentStrong }}>
                  {compatibilityScore}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomRow}>
            {matchedAt && (
              <Text variant="caption" style={{ color: colors.textTertiary }}>
                Matched {matchedAt}
              </Text>
            )}
            {expiry.text ? (
              <View
                style={[
                  styles.expiryBadge,
                  {
                    backgroundColor: expiry.isExpired ? colors.errorSoft : colors.warningSoft,
                    borderColor: expiry.isExpired ? colors.error : colors.warning,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Icon
                  name="alertCircle"
                  size="tiny"
                  color={expiry.isExpired ? colors.error : colors.warning}
                  style={{ marginRight: 4 }}
                />
                <Text
                  variant="caption"
                  weight="medium"
                  style={{ color: expiry.isExpired ? colors.error : colors.warning }}
                >
                  {expiry.text}
                </Text>
              </View>
            ) : status && status !== 'ACTIVE' ? (
              <View
                style={[
                  styles.expiryBadge,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Text variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                  {status}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  newDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
    gap: 6,
  },
  sparkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingRight: 8,
    gap: 8,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
});
