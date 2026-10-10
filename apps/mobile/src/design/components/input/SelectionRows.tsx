import React from 'react';
import {
  View,
  TouchableOpacity,
  Switch,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { haptics } from '../../haptics/index.js';
import { ensureMinTouchTarget, MIN_TOUCH_TARGET } from '../../a11y/index.js';

// --- CHIP ---
export interface ChipProps {
  readonly label: string;
  readonly icon?: IconName;
  readonly variant?: 'neutral' | 'accent' | 'outlined';
  readonly size?: 'sm' | 'md';
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  variant = 'neutral',
  size = 'md',
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return {
          bg: colors.accentSoft,
          border: colors.accent,
          text: colors.accentStrong,
        };
      case 'outlined':
        return {
          bg: 'transparent',
          border: colors.border,
          text: colors.textPrimary,
        };
      case 'neutral':
      default:
        return {
          bg: colors.surfaceMuted,
          border: colors.border,
          text: colors.textPrimary,
        };
    }
  };

  const vs = getVariantStyles();
  const isSm = size === 'sm';

  const Content = (
    <View
      style={[
        styles.chipBase,
        {
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderRadius: radii.radiusFull,
          paddingHorizontal: isSm ? spacing.sm : spacing.md,
          paddingVertical: isSm ? spacing.xxs : spacing.xs,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={label}
    >
      {icon && (
        <Icon
          name={icon}
          size={isSm ? 'tiny' : 'sm'}
          color={vs.text}
          style={{ marginRight: spacing.xs }}
        />
      )}
      <Text variant={isSm ? 'caption' : 'bodySmall'} weight="medium" style={{ color: vs.text }}>
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    const handlePress = () => {
      haptics.selection();
      onPress();
    };

    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        hitSlop={
          isSm
            ? ensureMinTouchTarget(MIN_TOUCH_TARGET, 32)
            : ensureMinTouchTarget(MIN_TOUCH_TARGET, 38)
        }
      >
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
};

// --- SELECTABLE CHIP ---
export interface SelectableChipProps {
  readonly label: string;
  readonly icon?: IconName;
  readonly isSelected?: boolean;
  readonly selected?: boolean;
  readonly onToggle?: () => void;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const SelectableChip: React.FC<SelectableChipProps> = ({
  label,
  icon,
  isSelected,
  selected,
  onToggle,
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const active = Boolean(isSelected ?? selected);
  const handlePress = onToggle || onPress;

  return (
    <Chip
      label={label}
      icon={active ? 'check' : icon}
      variant={active ? 'accent' : 'neutral'}
      onPress={handlePress}
      disabled={disabled}
      style={style}
      testID={testID}
    />
  );
};

// --- RADIO ROW ---
export interface RadioRowProps {
  readonly label: string;
  readonly description?: string;
  readonly isSelected?: boolean;
  readonly selected?: boolean;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const RadioRow: React.FC<RadioRowProps> = ({
  label,
  description,
  isSelected,
  selected,
  onSelect,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, spacing } = useTheme();
  const active = Boolean(isSelected ?? selected);

  const handlePress = () => {
    if (disabled) return;
    haptics.selection();
    onSelect();
  };

  return (
    <TouchableOpacity
      style={[
        styles.rowContainer,
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={`${label}${description ? `, ${description}` : ''}`}
      testID={testID}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text variant="body" weight="medium" style={{ color: colors.textPrimary }}>
          {label}
        </Text>
        {description && (
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.radioCircle,
          {
            borderColor: active ? colors.accent : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {active && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
      </View>
    </TouchableOpacity>
  );
};

// --- CHECKBOX ROW ---
export interface CheckboxRowProps {
  readonly label: string;
  readonly description?: string;
  readonly isChecked?: boolean;
  readonly checked?: boolean;
  readonly onToggle: () => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const CheckboxRow: React.FC<CheckboxRowProps> = ({
  label,
  description,
  isChecked,
  checked,
  onToggle,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const active = Boolean(isChecked ?? checked);

  const handlePress = () => {
    if (disabled) return;
    haptics.selection();
    onToggle();
  };

  return (
    <TouchableOpacity
      style={[
        styles.rowContainer,
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={`${label}${description ? `, ${description}` : ''}`}
      testID={testID}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text variant="body" weight="medium" style={{ color: colors.textPrimary }}>
          {label}
        </Text>
        {description && (
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.checkboxSquare,
          {
            borderColor: active ? colors.accent : colors.border,
            backgroundColor: active ? colors.accent : colors.surface,
            borderRadius: radii.radiusSM,
          },
        ]}
      >
        {active && <Icon name="check" size="tiny" color="#FFFFFF" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
};

// --- TOGGLE (SWITCH) ---
export interface ToggleProps {
  readonly label?: string;
  readonly description?: string;
  readonly isEnabled?: boolean;
  readonly value?: boolean;
  readonly onToggle?: (value: boolean) => void;
  readonly onValueChange?: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  isEnabled,
  value,
  onToggle,
  onValueChange,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, spacing } = useTheme();
  const active = Boolean(isEnabled ?? value);
  const handleToggle = (val: boolean) => {
    haptics.selection();
    if (onToggle) onToggle(val);
    if (onValueChange) onValueChange(val);
  };

  if (!label) {
    return (
      <Switch
        value={active}
        onValueChange={handleToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#FFFFFF"
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[
        styles.rowContainer,
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text variant="body" weight="medium" style={{ color: colors.textPrimary }}>
          {label}
        </Text>
        {description && (
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>

      <Switch
        value={active}
        onValueChange={handleToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#FFFFFF"
        accessibilityLabel={`${label}${description ? `, ${description}` : ''}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: MIN_TOUCH_TARGET,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
