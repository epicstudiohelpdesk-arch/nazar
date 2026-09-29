import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing } from '@platform/ui';

export interface BlockModalProps {
  readonly visible: boolean;
  readonly targetUserId: string;
  readonly targetUserName?: string;
  readonly onClose: () => void;
  readonly onConfirm: (targetUserId: string, reason?: string) => Promise<void>;
}

export const BlockModal: React.FC<BlockModalProps> = ({
  visible,
  targetUserId,
  targetUserName,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setReason('');
    setIsSubmitting(false);
    onClose();
  };

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(targetUserId, reason.trim() || undefined);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to block user';
      Alert.alert('Block Error', msg);
      setIsSubmitting(false);
    }
  };

  const displayName = targetUserName || 'this user';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
      testID="block-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Block {displayName}?</Text>
          <Text style={styles.body}>
            Once blocked:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Your match will be immediately dissolved.</Text>
            <Text style={styles.bulletItem}>• Any active conversation will be closed.</Text>
            <Text style={styles.bulletItem}>• Neither of you will see each other in discovery.</Text>
            <Text style={styles.bulletItem}>• Neither of you will be able to message or interact.</Text>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="Reason for blocking (optional)..."
            placeholderTextColor={colors.neutral[400]}
            maxLength={250}
            value={reason}
            onChangeText={setReason}
            testID="block-reason-input"
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSubmitting}
              testID="block-cancel-btn"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.blockButton}
              onPress={handleConfirm}
              disabled={isSubmitting}
              testID="block-confirm-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.blockButtonText}>Block User</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 14,
    color: colors.neutral[700],
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  bulletList: {
    marginVertical: spacing.xs,
    paddingLeft: spacing.xs,
  },
  bulletItem: {
    fontSize: 13,
    color: colors.neutral[700],
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.neutral[900],
    backgroundColor: colors.neutral[50],
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  blockButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  blockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
