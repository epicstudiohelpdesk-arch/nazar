import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { Toggle } from '../../components/input/SelectionRows.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- SETTINGS SECTION ---
export interface SettingsSectionProps {
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children, style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.sectionWrapper, { marginBottom: spacing.lg }, style]}>
      {title && (
        <Text
          variant="label"
          weight="semibold"
          style={{ color: colors.textSecondary, marginBottom: spacing.xs, paddingHorizontal: 4 }}
        >
          {title.toUpperCase()}
        </Text>
      )}
      <SurfaceCard p="none" radius="radiusLG" style={styles.sectionCard}>
        {children}
      </SurfaceCard>
    </View>
  );
};

// --- SETTINGS ROW ---
export interface SettingsRowProps {
  readonly label: string;
  readonly icon?: IconName;
  readonly description?: string;
  readonly onPress?: () => void;
  readonly isDestructive?: boolean;
  readonly isLast?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  icon,
  description,
  onPress,
  isDestructive = false,
  isLast = false,
  style,
  testID,
}) => {
  const { colors, spacing } = useTheme();
  const textColor = isDestructive ? colors.error : colors.textPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : 1,
        },
        style,
      ]}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${label}${description ? `, ${description}` : ''}`}
      testID={testID}
    >
      {icon && (
        <Icon
          name={icon}
          size="sm"
          color={isDestructive ? colors.error : colors.textSecondary}
          style={{ marginRight: spacing.md }}
        />
      )}

      <View style={{ flex: 1 }}>
        <Text variant="body" weight="medium" style={{ color: textColor }}>
          {label}
        </Text>
        {description && (
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>

      {onPress && <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />}
    </TouchableOpacity>
  );
};

// --- SETTINGS VALUE ROW ---
export interface SettingsValueRowProps extends Omit<SettingsRowProps, 'description'> {
  readonly value: string;
}

export const SettingsValueRow: React.FC<SettingsValueRowProps> = ({
  label,
  value,
  icon,
  onPress,
  isLast = false,
  style,
  testID,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : 1,
        },
        style,
      ]}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${label}: ${value}`}
      testID={testID}
    >
      {icon && (
        <Icon
          name={icon}
          size="sm"
          color={colors.textSecondary}
          style={{ marginRight: spacing.md }}
        />
      )}

      <Text variant="body" weight="medium" style={{ color: colors.textPrimary, flex: 1 }}>
        {label}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          variant="bodySmall"
          style={{ color: colors.textSecondary, marginRight: onPress ? spacing.xs : 0 }}
        >
          {value}
        </Text>
        {onPress && (
          <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

// --- SETTINGS TOGGLE ---
export interface SettingsToggleProps {
  readonly label: string;
  readonly description?: string;
  readonly icon?: IconName;
  readonly isEnabled: boolean;
  readonly onToggle: (value: boolean) => void;
  readonly isLast?: boolean;
  readonly testID?: string;
  /**
   * Disables the row while its own mutation is in flight. Kept local to the row
   * so one slow preference write does not block the rest of the form.
   */
  readonly isBusy?: boolean;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  label,
  description,
  icon,
  isEnabled,
  onToggle,
  isLast = false,
  testID,
  isBusy = false,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: isLast ? 0 : 1,
        },
      ]}
      testID={testID}
    >
      {icon && (
        <Icon
          name={icon}
          size="sm"
          color={colors.textSecondary}
          style={{ marginRight: spacing.md }}
        />
      )}

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

      <Toggle
        isEnabled={isEnabled}
        onToggle={onToggle}
        disabled={isBusy}
        label={`${label}${description ? `, ${description}` : ''}`}
      />
    </View>
  );
};

export const SettingsToggleRow = SettingsToggle;

// --- DANGER ZONE ---
export interface DangerZoneProps {
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const DangerZone: React.FC<DangerZoneProps> = ({
  title = 'Danger Zone',
  children,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.sectionWrapper, { marginBottom: spacing.lg }, style]}>
      <Text
        variant="label"
        weight="semibold"
        style={{ color: colors.error, marginBottom: spacing.xs, paddingHorizontal: 4 }}
      >
        {title.toUpperCase()}
      </Text>
      <SurfaceCard
        p="none"
        radius="radiusLG"
        style={[styles.sectionCard, { borderColor: colors.errorSoft }]}
      >
        {children}
      </SurfaceCard>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionWrapper: {
    width: '100%',
  },
  sectionCard: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});
