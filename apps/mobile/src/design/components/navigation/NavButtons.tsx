import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { TopNavHeader } from './TopNavHeader.js';
import { BottomNavBar } from './BottomNavBar.js';
import { BottomNavItem } from './BottomNavItem.js';

export const TopBar = TopNavHeader;
export const BottomTabBar = BottomNavBar;
export const TabItem = BottomNavItem;

export interface BackButtonProps {
  readonly onPress: () => void;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, color, style, testID }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.navBtn, style]}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      testID={testID || 'nav.button.back'}
    >
      <Icon name="back" size="md" color={color || colors.textPrimary} />
    </TouchableOpacity>
  );
};

export interface CloseButtonProps {
  readonly onPress: () => void;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ onPress, color, style, testID }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.navBtn, style]}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Close"
      testID={testID || 'nav.button.close'}
    >
      <Icon name="close" size="md" color={color || colors.textPrimary} />
    </TouchableOpacity>
  );
};

export interface HeaderActionProps {
  readonly onPress: () => void;
  readonly label?: string;
  readonly icon?: IconName;
  readonly isDestructive?: boolean;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const HeaderAction: React.FC<HeaderActionProps> = ({
  onPress,
  label,
  icon,
  isDestructive = false,
  disabled = false,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const textColor = isDestructive ? colors.error : colors.accent;

  return (
    <TouchableOpacity
      style={[styles.navBtn, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label || (icon ? `${icon} action` : 'Header action')}
      testID={testID || 'nav.button.action'}
    >
      {icon ? (
        <Icon name={icon} size="md" color={textColor} />
      ) : label ? (
        <Text variant="button" weight="semibold" style={{ color: textColor }}>
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  navBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
