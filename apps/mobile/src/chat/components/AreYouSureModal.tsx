import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { Button } from '../../design/components/button/Button.js';
import { haptics } from '../../design/haptics/index.js';

export interface AreYouSureModalProps {
  readonly visible: boolean;
  readonly messageText: string;
  readonly reason?: string;
  readonly onEdit: () => void;
  readonly onSendAnyway: () => void;
}

export const AreYouSureModal: React.FC<AreYouSureModalProps> = ({
  visible,
  messageText,
  reason,
  onEdit,
  onSendAnyway,
}) => {
  const { colors, spacing, radii } = useTheme();

  React.useEffect(() => {
    if (visible) {
      haptics.notificationWarning();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onEdit}
      testID="modal-are-you-sure"
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <SurfaceCard
          elevation="lg"
          style={[styles.card, { backgroundColor: colors.surface }]}
        >
          {/* Header Icon */}
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.warningSoft },
            ]}
          >
            <Icon name="shield" size="md" color={colors.warning} />
          </View>

          {/* Title & Description */}
          <Heading level="h2" style={{ textAlign: 'center', marginBottom: spacing.xs }}>
            Are You Sure?
          </Heading>

          <Text
            variant="bodySmall"
            color="secondary"
            style={{ textAlign: 'center', marginBottom: spacing.md }}
          >
            Nazar values intentional and dignified interactions. This message contains language that
            may be hurtful or violate community guidelines:
          </Text>

          {reason && (
            <View
              style={[
                styles.reasonBox,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  borderRadius: radii.radiusMD,
                  padding: spacing.sm,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text variant="caption" weight="medium" color="warning" style={{ textAlign: 'center' }}>
                {reason}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.quoteBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderLeftColor: colors.warning,
                padding: spacing.sm,
                borderRadius: radii.radiusSM,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <Text
              variant="caption"
              color="secondary"
              numberOfLines={3}
              style={{ fontStyle: 'italic' }}
            >
              "{messageText}"
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              variant="primary"
              size="md"
              icon="edit"
              onPress={() => {
                haptics.selection();
                onEdit();
              }}
              testID="btn-ays-edit"
            >
              Edit Message
            </Button>

            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                onSendAnyway();
              }}
              style={[styles.sendAnywayBtn, { marginTop: spacing.sm }]}
              accessibilityRole="button"
              accessibilityLabel="Send message anyway"
              testID="btn-ays-send-anyway"
            >
              <Text variant="caption" color="tertiary" style={{ textDecorationLine: 'underline' }}>
                Send Anyway
              </Text>
            </TouchableOpacity>
          </View>
        </SurfaceCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reasonBox: {
    width: '100%',
    borderWidth: 1,
  },
  quoteBox: {
    width: '100%',
    borderLeftWidth: 3,
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  sendAnywayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
