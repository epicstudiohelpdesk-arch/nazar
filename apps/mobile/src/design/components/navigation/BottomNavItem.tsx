import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';

export interface BottomNavItemProps {
  readonly icon: IconName;
  readonly label: string;
  readonly isSelected: boolean;
  readonly badgeCount?: number;
  readonly onPress: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const BottomNavItem: React.FC<BottomNavItemProps> = ({
  icon,
  label,
  isSelected,
  badgeCount = 0,
  onPress,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.item, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${label} tab${badgeCount > 0 ? `, ${badgeCount} unread` : ''}`}
      testID={testID}
    >
      <View style={styles.iconWrapper}>
        <Icon
          name={icon}
          size="md"
          color={isSelected ? colors.accent : colors.textTertiary}
        />
        {badgeCount > 0 && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.accent,
                borderRadius: radii.radiusFull,
                borderColor: colors.surface,
              },
            ]}
          >
            <Text variant="caption" weight="bold" style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>

      <Text
        variant="caption"
        weight={isSelected ? 'semibold' : 'normal'}
        style={{
          color: isSelected ? colors.accent : colors.textTertiary,
          marginTop: 4,
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 48,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 11,
  },
});
