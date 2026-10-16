import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/theme/index.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { Button } from '../../design/components/button/Button.js';
import { haptics } from '../../design/haptics/index.js';
import {
  getDefaultSafetyApi,
  invalidateSafetyCaches,
} from '../safety-api.js';

export interface PhotoVerificationModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onVerifiedSuccess?: () => void;
}

export const PhotoVerificationModal: React.FC<PhotoVerificationModalProps> = ({
  visible,
  onClose,
  onVerifiedSuccess,
}) => {
  const { colors, spacing, radii } = useTheme();
  const queryClient = useQueryClient();
  const safetyApi = getDefaultSafetyApi();

  const [hasCaptured, setHasCaptured] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  const challengeQuery = useQuery({
    queryKey: ['safety', 'verification-challenge'],
    queryFn: () => safetyApi.getVerificationChallenge(),
    enabled: visible,
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { challengeToken: string; gesture: any; selfiePhotoUrl: string }) =>
      safetyApi.submitPhotoVerification(payload),
    onSuccess: (data) => {
      invalidateSafetyCaches(queryClient);
      haptics.notificationSuccess();
      Alert.alert('Verification Complete', data.message);
      onVerifiedSuccess?.();
      handleClose();
    },
    onError: (err: unknown) => {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Photo verification failed';
      Alert.alert('Verification Error', msg);
    },
  });

  const handleClose = () => {
    setHasCaptured(false);
    setCapturedPhotoUrl(null);
    onClose();
  };

  const handleCapturePhoto = () => {
    haptics.selection();
    // In production, launches front camera; here sets mock high-res selfie URL
    setCapturedPhotoUrl('https://cdn.nazar.app/verifications/selfie-live.jpg');
    setHasCaptured(true);
  };

  const handleSubmit = () => {
    if (!challengeQuery.data || !capturedPhotoUrl) return;
    haptics.selection();

    verifyMutation.mutate({
      challengeToken: challengeQuery.data.challengeToken,
      gesture: challengeQuery.data.gesture,
      selfiePhotoUrl: capturedPhotoUrl,
    });
  };

  const challenge = challengeQuery.data;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      testID="modal-photo-verification"
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <SurfaceCard
          elevation="lg"
          style={[styles.card, { backgroundColor: colors.surface }]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.badgeBox,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Icon name="shield" size="md" color={colors.accent} />
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close verification"
              testID="btn-verification-close"
            >
              <Icon name="close" size="sm" color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Heading level="h2" style={{ textAlign: 'center', marginBottom: spacing.xs }}>
            Photo Verification
          </Heading>

          <Text
            variant="bodySmall"
            color="secondary"
            style={{ textAlign: 'center', marginBottom: spacing.lg }}
          >
            Prove you are genuinely you. Match the dynamic selfie pose below to earn the Verified badge.
          </Text>

          {challengeQuery.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text variant="caption" color="secondary" style={{ marginTop: spacing.sm }}>
                Generating dynamic pose challenge...
              </Text>
            </View>
          ) : challenge ? (
            <>
              {/* Pose Card */}
              <View
                style={[
                  styles.challengeBox,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: radii.radiusMD,
                    padding: spacing.md,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                <View style={styles.poseIconBox}>
                  <Icon name="user" size="lg" color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" weight="bold" color="accent" style={{ textTransform: 'uppercase' }}>
                    Assigned Pose: {challenge.gesture.replace(/_/g, ' ')}
                  </Text>
                  <Text variant="bodySmall" color="primary" style={{ marginTop: 2 }}>
                    {challenge.gesturePrompt}
                  </Text>
                </View>
              </View>

              {/* Camera Frame Preview / Status */}
              <View
                style={[
                  styles.cameraPreviewBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: hasCaptured ? colors.success : colors.border,
                    borderRadius: radii.radiusLG,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                {hasCaptured ? (
                  <View style={styles.capturedState}>
                    <Icon name="check" size="lg" color={colors.success} />
                    <Text variant="bodySmall" weight="semibold" color="success" style={{ marginTop: 4 }}>
                      Pose Captured!
                    </Text>
                    <Text variant="caption" color="secondary">
                      Ready to submit for verification
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.capturePrompt}
                    onPress={handleCapturePhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Take selfie"
                    testID="btn-capture-selfie"
                  >
                    <Icon name="camera" size="lg" color={colors.accent} />
                    <Text variant="bodySmall" weight="medium" color="accent" style={{ marginTop: 6 }}>
                      Tap to Take Selfie
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {hasCaptured ? (
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      isLoading={verifyMutation.isPending}
                      onPress={handleSubmit}
                      testID="btn-submit-verification"
                    >
                      Submit for Verification
                    </Button>
                    <TouchableOpacity
                      onPress={handleCapturePhoto}
                      style={{ marginTop: spacing.sm, padding: spacing.xs }}
                      accessibilityRole="button"
                      testID="btn-retake-selfie"
                    >
                      <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                        Retake Photo
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onPress={handleCapturePhoto}
                    testID="btn-take-selfie"
                  >
                    Capture Pose
                  </Button>
                )}
              </View>
            </>
          ) : (
            <Text variant="bodySmall" color="error" style={{ textAlign: 'center' }}>
              Could not load challenge pose. Please try again.
            </Text>
          )}
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
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 8,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  poseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPreviewBox: {
    height: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturePrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  capturedState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    width: '100%',
  },
});
