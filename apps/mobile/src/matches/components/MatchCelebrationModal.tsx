import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { colors, spacing, typography } from '@platform/ui';

export interface MatchedCelebrationUser {
  readonly displayName: string;
  readonly age?: number;
  readonly primaryPhotoUrl?: string | null;
  readonly city?: string | null;
  readonly countryCode?: string | null;
}

export interface MatchCelebrationModalProps {
  readonly visible: boolean;
  readonly matchedUser: MatchedCelebrationUser | null;
  readonly matchId: string | null;
  readonly onClose: () => void;
  readonly onViewMatches?: () => void;
  readonly testID?: string;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  visible,
  matchedUser,
  onClose,
  onViewMatches,
  testID = 'match-celebration-modal',
}) => {
  if (!visible || !matchedUser) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Confetti / Celebration Header */}
          <Text style={styles.celebrationEmoji}>✨ 🎉 ✨</Text>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>
            You and {matchedUser.displayName} liked each other.
          </Text>

          {/* Photo */}
          <View style={styles.photoContainer}>
            {matchedUser.primaryPhotoUrl ? (
              <Image
                source={{ uri: matchedUser.primaryPhotoUrl }}
                style={styles.photo}
                resizeMode="cover"
                accessibilityLabel={`${matchedUser.displayName}'s photo`}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>
                  {matchedUser.displayName.charAt(0)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.userName}>
            {matchedUser.displayName}
            {matchedUser.age ? `, ${matchedUser.age}` : ''}
          </Text>

          {matchedUser.city ? (
            <Text style={styles.userLocation}>
              📍 {matchedUser.city}
              {matchedUser.countryCode ? `, ${matchedUser.countryCode}` : ''}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            {onViewMatches && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  onClose();
                  onViewMatches();
                }}
                accessibilityRole="button"
                accessibilityLabel="View Matches list"
                testID="match-view-matches-btn"
              >
                <Text style={styles.primaryButtonText}>View Matches</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Keep browsing discovery feed"
              testID="match-keep-browsing-btn"
            >
              <Text style={styles.secondaryButtonText}>Keep Browsing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.neutral[50],
    borderRadius: spacing.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  photoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.primary[500],
    marginBottom: spacing.md,
    backgroundColor: colors.neutral[200],
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
  },
  userName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  userLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.xl,
  },
  buttonsContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.neutral[50],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  secondaryButton: {
    backgroundColor: colors.neutral[200],
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.neutral[800],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
});
