import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { haptics } from '../../haptics/index.js';

export type TopNavLeftAction = 'back' | 'close' | 'none';

export interface TopNavRightAction {
  readonly icon?: IconName;
  readonly label?: string;
  readonly onPress: () => void;
  readonly isDestructive?: boolean;
}

export interface TopNavHeaderProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly leftAction?: TopNavLeftAction;
  readonly onLeftAction?: () => void;
  readonly onBack?: () => void;
  readonly rightAction?: TopNavRightAction | React.ReactNode;
  readonly transparent?: boolean;
  readonly includeSafeArea?: boolean;
  readonly bordered?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  title,
  subtitle,
  leftAction = 'back',
  onLeftAction,
  onBack,
  rightAction,
  transparent = true,
  includeSafeArea,
  bordered = false,
  style,
  testID,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();

  const handleLeftPress = () => {
    haptics.impactLight();
    if (onLeftAction) {
      onLeftAction();
      return;
    }
    if (onBack) {
      onBack();
      return;
    }
    // Safe default navigation fallback if router can go back or return to discovery
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  // Only pad safe area if explicitly enabled or if insets are needed and not in a SafeAreaView
  const shouldPadSafeArea = includeSafeArea === true;
  const resolvedPaddingTop = shouldPadSafeArea ? Math.max(insets.top, 8) : 4;

  const hasTitle = Boolean(title && title.trim().length > 0);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: resolvedPaddingTop,
          paddingHorizontal: spacing.sm,
          backgroundColor: transparent ? 'transparent' : colors.surface,
          borderBottomColor: bordered ? colors.border : 'transparent',
          borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="header"
    >
      <View style={styles.contentRow}>
        {/* Left Action (Back or Modal Close) */}
        <View style={styles.actionCol}>
          {leftAction === 'back' && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleLeftPress}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              testID="top-nav-back-btn"
            >
              <Icon name="back" size="sm" color={colors.textPrimary} />
            </TouchableOpacity>
          )}

          {leftAction === 'close' && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleLeftPress}
              accessibilityRole="button"
              accessibilityLabel="Close screen"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              testID="top-nav-close-btn"
            >
              <Icon name="close" size="sm" color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center Title & Subtitle */}
        {hasTitle && (
          <View style={styles.titleCol}>
            <Heading level="h3" align="center" numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Heading>
            {subtitle && (
              <Text
                variant="caption"
                align="center"
                style={{ color: colors.textTertiary, marginTop: 1 }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}

        {/* Right Action */}
        <View style={[styles.actionCol, { alignItems: 'flex-end' }]}>
          {rightAction &&
            (React.isValidElement(rightAction) ? (
              rightAction
            ) : (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
                onPress={(rightAction as TopNavRightAction).onPress}
                accessibilityRole="button"
                accessibilityLabel={(rightAction as TopNavRightAction).label || 'Action'}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                {(rightAction as TopNavRightAction).icon ? (
                  <Icon
                    name={(rightAction as TopNavRightAction).icon!}
                    size="sm"
                    color={
                      (rightAction as TopNavRightAction).isDestructive
                        ? colors.error
                        : colors.accent
                    }
                  />
                ) : (rightAction as TopNavRightAction).label ? (
                  <Text
                    variant="button"
                    style={{
                      color: (rightAction as TopNavRightAction).isDestructive
                        ? colors.error
                        : colors.accent,
                      fontSize: 13.5,
                      fontWeight: '600',
                    }}
                  >
                    {(rightAction as TopNavRightAction).label}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  actionCol: {
    minWidth: 40,
    justifyContent: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
