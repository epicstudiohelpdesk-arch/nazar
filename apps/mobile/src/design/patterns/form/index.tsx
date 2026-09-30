import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Button } from '../../components/button/Button.js';

// --- FORM SECTION ---
export interface FormSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.sectionContainer, { marginBottom: spacing.lg }, style]}>
      <Heading level="h3" style={{ marginBottom: description ? 4 : spacing.sm }}>
        {title}
      </Heading>
      {description && (
        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginBottom: spacing.sm }}>
          {description}
        </Text>
      )}
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
};

// --- FORM ROW ---
export interface FormRowProps {
  readonly children: React.ReactNode;
  readonly gap?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const FormRow: React.FC<FormRowProps> = ({ children, gap = 12, style }) => {
  return <View style={[styles.formRow, { gap }, style]}>{children}</View>;
};

// --- FORM FIELD ---
export interface FormFieldProps {
  readonly label?: string;
  readonly helperText?: string;
  readonly errorMessage?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  helperText,
  errorMessage,
  error,
  required = false,
  children,
  style,
}) => {
  const { colors, spacing } = useTheme();
  const effectiveError = errorMessage || error;

  return (
    <View style={[styles.fieldContainer, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text variant="label" weight="medium" style={{ color: colors.textSecondary }}>
            {label}
          </Text>
          {required && (
            <Text variant="label" style={{ color: colors.error, marginLeft: 2 }}>
              *
            </Text>
          )}
        </View>
      )}

      {children}

      {effectiveError ? (
        <View style={[styles.feedbackRow, { marginTop: spacing.xxs }]}>
          <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xxs }} />
          <Text variant="caption" style={{ color: colors.error }}>
            {effectiveError}
          </Text>
        </View>
      ) : helperText ? (
        <Text variant="caption" style={{ color: colors.textTertiary, marginTop: spacing.xxs }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

// --- FORM ACTIONS ---
export interface FormActionsProps {
  readonly primaryLabel?: string;
  readonly secondaryLabel?: string;
  readonly onPrimaryPress: () => void;
  readonly onSecondaryPress?: () => void;
  readonly isSubmitting?: boolean;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export const FormActions: React.FC<FormActionsProps> = ({
  primaryLabel = 'Save',
  secondaryLabel = 'Cancel',
  onPrimaryPress,
  onSecondaryPress,
  isSubmitting = false,
  disabled = false,
  style,
}) => {
  const { spacing } = useTheme();

  return (
    <View style={[styles.actionsRow, { gap: spacing.sm }, style]}>
      {onSecondaryPress && (
        <Button
          label={secondaryLabel}
          variant="secondary"
          size="lg"
          onPress={onSecondaryPress}
          disabled={isSubmitting}
          style={{ flex: 1 }}
        />
      )}
      <Button
        label={primaryLabel}
        variant="primary"
        size="lg"
        onPress={onPrimaryPress}
        isLoading={isSubmitting}
        disabled={disabled}
        style={{ flex: onSecondaryPress ? 2 : 1 }}
        fullWidth={!onSecondaryPress}
      />
    </View>
  );
};

// --- STICKY FORM ACTIONS ---
export type StickyFormActionsProps = FormActionsProps;

export const StickyFormActions: React.FC<StickyFormActionsProps> = (props) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, shadows } = useTheme();

  return (
    <View
      style={[
        styles.stickyContainer,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, 12),
          ...shadows.shadowMD,
        },
      ]}
    >
      <FormActions {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    width: '100%',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  fieldContainer: {
    width: '100%',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stickyContainer: {
    width: '100%',
    borderTopWidth: 1,
  },
});
