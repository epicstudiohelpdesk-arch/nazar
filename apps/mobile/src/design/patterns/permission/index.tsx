import React from 'react';
import { View, Linking, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { Button } from '../../components/button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- OPEN SYSTEM SETTINGS ACTION ---
export interface OpenSystemSettingsActionProps {
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const OpenSystemSettingsAction: React.FC<OpenSystemSettingsActionProps> = ({
  label = 'Open Device Settings',
  style,
}) => {
  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  return (
    <Button
      label={label}
      variant="secondary"
      size="md"
      onPress={handleOpenSettings}
      icon="settings"
      style={style}
    />
  );
};

// --- PERMISSION EXPLANATION ---
export interface PermissionExplanationProps {
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
  readonly benefit: string;
  readonly onRequestPermission: () => void;
  readonly onSkip?: () => void;
  readonly isSubmitting?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export const PermissionExplanation: React.FC<PermissionExplanationProps> = ({
  icon,
  title,
  description,
  benefit,
  onRequestPermission,
  onSkip,
  isSubmitting = false,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.accentSoft,
            borderColor: colors.accent,
            borderRadius: radii.radiusFull,
          },
        ]}
      >
        <Icon name={icon} size="lg" color={colors.accentStrong} />
      </View>

      <Heading level="h2" align="center" style={{ marginTop: spacing.md }}>
        {title}
      </Heading>

      <Text
        variant="body"
        align="center"
        style={{ color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 }}
      >
        {description}
      </Text>

      <SurfaceCard
        p="sm"
        radius="radiusMD"
        style={{
          marginTop: spacing.md,
          marginBottom: spacing.lg,
          backgroundColor: colors.surfaceMuted,
          width: '100%',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            name="check"
            size="tiny"
            color={colors.accent}
            style={{ marginRight: spacing.xs }}
          />
          <Text variant="caption" weight="medium" style={{ color: colors.textPrimary, flex: 1 }}>
            {benefit}
          </Text>
        </View>
      </SurfaceCard>

      <View style={{ width: '100%', gap: spacing.sm }}>
        <Button
          label="Allow Access"
          variant="primary"
          size="lg"
          fullWidth
          onPress={onRequestPermission}
          isLoading={isSubmitting}
        />
        {onSkip && (
          <Button
            label="Maybe Later"
            variant="tertiary"
            size="md"
            fullWidth
            onPress={onSkip}
            disabled={isSubmitting}
          />
        )}
      </View>
    </View>
  );
};

// --- PERMISSION DENIED STATE ---
export interface PermissionDeniedStateProps {
  readonly permissionName: string;
  readonly reason: string;
  readonly onOpenSettings?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const PermissionDeniedState: React.FC<PermissionDeniedStateProps> = ({
  permissionName,
  reason,
  onOpenSettings,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  const handleSettings = onOpenSettings || (() => Linking.openSettings().catch(() => {}));

  return (
    <SurfaceCard p="lg" radius="radiusLG" style={style}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={[
            styles.warningCircle,
            {
              backgroundColor: colors.warningSoft,
              borderRadius: radii.radiusFull,
            },
          ]}
        >
          <Icon name="warning" size="md" color={colors.warning} />
        </View>

        <Heading level="h3" align="center" style={{ marginTop: spacing.sm }}>
          {permissionName} Access Needed
        </Heading>

        <Text
          variant="bodySmall"
          align="center"
          style={{ color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md }}
        >
          {reason}
        </Text>

        <Button
          label="Enable in Settings"
          variant="secondary"
          size="md"
          onPress={handleSettings}
          icon="settings"
        />
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  warningCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
