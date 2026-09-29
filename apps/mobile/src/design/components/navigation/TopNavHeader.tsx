import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon, type IconName } from '../../primitives/Icon.js';

export type TopNavLeftAction = 'back' | 'close' | 'none';

export interface TopNavRightAction {
  readonly icon?: IconName;
  readonly label?: string;
  readonly onPress: () => void;
  readonly isDestructive?: boolean;
}

export interface TopNavHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly leftAction?: TopNavLeftAction;
  readonly onLeftAction?: () => void;
  readonly rightAction?: TopNavRightAction;
  readonly transparent?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  title,
  subtitle,
  leftAction = 'back',
  onLeftAction,
  rightAction,
  transparent = false,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingHorizontal: spacing.md,
          backgroundColor: transparent ? 'transparent' : colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: transparent ? 0 : 1,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="header"
    >
      <View style={styles.contentRow}>
        {/* Left Action (Back or Modal Close) */}
        <View style={styles.actionCol}>
          {leftAction === 'back' && onLeftAction && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onLeftAction}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="back" size="md" color={colors.textPrimary} />
            </TouchableOpacity>
          )}

          {leftAction === 'close' && onLeftAction && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onLeftAction}
              accessibilityRole="button"
              accessibilityLabel="Close screen"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="close" size="md" color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center Title & Subtitle */}
        <View style={styles.titleCol}>
          <Heading level="h3" align="center" numberOfLines={1}>
            {title}
          </Heading>
          {subtitle && (
            <Text
              variant="caption"
              align="center"
              style={{ color: colors.textTertiary, marginTop: 2 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Action */}
        <View style={[styles.actionCol, { alignItems: 'flex-end' }]}>
          {rightAction && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={rightAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label || 'Action'}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {rightAction.icon ? (
                <Icon
                  name={rightAction.icon}
                  size="md"
                  color={rightAction.isDestructive ? colors.error : colors.accent}
                />
              ) : rightAction.label ? (
                <Text
                  variant="button"
                  style={{
                    color: rightAction.isDestructive ? colors.error : colors.accent,
                  }}
                >
                  {rightAction.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  actionCol: {
    width: 60,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
