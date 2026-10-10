import React from 'react';
import { Modal, View, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Avatar } from '../../design/primitives/Avatar.js';
import { Button } from '../../design/components/button/Button.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';

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
  readonly myAvatarUrl?: string | null;
  readonly myName?: string;
  readonly onClose: () => void;
  readonly onStartChat?: (matchId: string) => void;
  readonly testID?: string;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  visible,
  matchedUser,
  matchId,
  myAvatarUrl,
  myName = 'You',
  onClose,
  onStartChat,
  testID = 'match-celebration-modal',
}) => {
  const { theme } = useTheme();

  if (!visible || !matchedUser) {
    return null;
  }

  const effectiveMyAvatar =
    myAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
  const effectiveMatchedAvatar =
    matchedUser.primaryPhotoUrl ||
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500';

  const handleMessage = () => {
    onClose();
    if (onStartChat && matchId) {
      onStartChat(matchId);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.backdrop} />
        <SurfaceCard
          elevation="lg"
          style={[styles.dialog, { backgroundColor: theme.colors.surfaceElevated }]}
        >
          <View style={styles.celebrationBadge}>
            <Text level="display">💕</Text>
          </View>

          <Heading level="h1" style={styles.title}>
            It's a Match!
          </Heading>
          <Text level="body" color="secondary" style={styles.subtitle}>
            You and {matchedUser.displayName} liked each other's profiles.
          </Text>

          <View style={styles.avatarRow}>
            <View style={[styles.avatarRing, { borderColor: theme.colors.accent }]}>
              <Avatar size="large" uri={effectiveMyAvatar} name={myName} />
            </View>
            <View
              style={[styles.avatarRing, { borderColor: theme.colors.accent, marginLeft: -16 }]}
            >
              <Avatar size="large" uri={effectiveMatchedAvatar} name={matchedUser.displayName} />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleMessage}
              accessibilityLabel="Start conversation"
              testID="matchCelebration.message"
            >
              Say Hello 💌
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={onClose}
              accessibilityLabel="Keep browsing connections"
              testID="matchCelebration.keepBrowsing"
            >
              Keep Browsing
            </Button>
          </View>
        </SurfaceCard>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  celebrationBadge: {
    marginBottom: -4,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarRow: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  avatarRing: {
    borderWidth: 3,
    borderRadius: 999,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
});
