import React, { useEffect } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Button } from '../button/Button.js';
import { haptics } from '../../haptics/index.js';
import { announceAccessibility } from '../../a11y/index.js';

export type DialogVariant = 'confirm' | 'destructive' | 'warning' | 'info';

export interface DialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly variant?: DialogVariant;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isSubmitting?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  visible,
  title,
  message,
  variant = 'confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isSubmitting = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing, shadows } = useTheme();

  useEffect(() => {
    if (visible) {
      announceAccessibility(`${title}. ${message}`);
      if (variant === 'destructive') {
        haptics.warning();
      }
    }
  }, [visible, title, message, variant]);

  const isDestructive = variant === 'destructive';

  const getHeaderIcon = () => {
    switch (variant) {
      case 'destructive':
        return (
          <View style={[styles.iconCircle, { backgroundColor: colors.errorSoft }]}>
            <Icon name="warning" size="md" color={colors.error} />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconCircle, { backgroundColor: colors.warningSoft }]}>
            <Icon name="warning" size="md" color={colors.warning} />
          </View>
        );
      case 'info':
        return (
          <View style={[styles.iconCircle, { backgroundColor: colors.infoSoft }]}>
            <Icon name="info" size="md" color={colors.info} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalRoot} testID={testID}>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />

        <View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.radiusXL,
              padding: spacing.lg,
              ...shadows.shadowLG,
            },
            style,
          ]}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
        >
          {getHeaderIcon()}

          <Heading level="h3" align="center" style={{ marginTop: 8 }}>
            {title}
          </Heading>

          <Text
            variant="body"
            align="center"
            style={{ color: colors.textSecondary, marginTop: 8, marginBottom: 20 }}
          >
            {message}
          </Text>

          <View style={styles.buttonStack}>
            <Button
              label={confirmLabel}
              variant={isDestructive ? 'destructive' : 'primary'}
              fullWidth={true}
              loading={isSubmitting}
              onPress={() => {
                if (isDestructive) {
                  haptics.error();
                } else {
                  haptics.medium();
                }
                onConfirm();
              }}
            />

            {Boolean(cancelLabel) && (
              <Button
                label={cancelLabel}
                variant="tertiary"
                fullWidth={true}
                disabled={isSubmitting}
                onPress={() => {
                  haptics.selection();
                  onCancel();
                }}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Semantic Convenience Dialogs
export const AlertDialog: React.FC<Omit<DialogProps, 'variant' | 'cancelLabel'>> = (props) => (
  <Dialog variant="info" cancelLabel="" {...props} />
);

export const ConfirmationDialog: React.FC<Omit<DialogProps, 'variant'>> = (props) => (
  <Dialog variant="confirm" {...props} />
);

export const DestructiveDialog: React.FC<Omit<DialogProps, 'variant'>> = (props) => (
  <Dialog variant="destructive" {...props} />
);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  buttonStack: {
    width: '100%',
  },
});
