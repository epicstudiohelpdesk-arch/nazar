import React, { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import type { CallType } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Avatar } from '../../design/primitives/Avatar.js';
import { Icon } from '../../design/primitives/Icon.js';

import { haptics } from '../../design/haptics/index.js';

export interface CallModalProps {
  readonly visible: boolean;
  readonly callType: CallType;
  readonly partnerName: string;
  readonly avatarUrl?: string | null;
  readonly onHangup: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  visible,
  callType,
  partnerName,
  avatarUrl,
  onHangup,
}) => {
  const { colors, spacing } = useTheme();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'VIDEO');
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'VIDEO');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!visible) {
      setSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onHangup}
      testID="modal-safe-call"
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isVideoOn ? '#0F0E0D' : colors.surfaceElevated },
        ]}
      >
        {/* Top Header */}
        <View style={styles.topInfo}>
          <View style={styles.securityBadge}>
            <Icon name="shield" size="tiny" color={colors.accent} />
            <Text variant="caption" weight="medium" style={{ color: colors.accent, marginLeft: 4 }}>
              End-to-End Encrypted Safe Call
            </Text>
          </View>
          <Heading level="h2" style={{ color: '#FFFFFF', marginTop: spacing.md }}>
            {partnerName}
          </Heading>
          <Text variant="bodySmall" style={{ color: '#A8A29E', marginTop: 4 }}>
            {seconds === 0 ? 'Connecting...' : formatTimer(seconds)}
          </Text>
        </View>

        {/* Center Visual / Avatar */}
        <View style={styles.centerContainer}>
          <View
            style={[
              styles.avatarGlow,
              { borderColor: isVideoOn ? colors.accent : 'rgba(255,255,255,0.1)' },
            ]}
          >
            <Avatar uri={avatarUrl} name={partnerName} size="lg" />
          </View>
          {isVideoOn && (
            <Text variant="caption" style={{ color: '#78716C', marginTop: 12 }}>
              Camera is active · Nazar safe video stream
            </Text>
          )}
        </View>

        {/* Bottom Call Controls */}
        <View style={styles.controlsRow}>
          {/* Mute Toggle */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              { backgroundColor: isMuted ? colors.error : 'rgba(255, 255, 255, 0.15)' },
            ]}
            onPress={() => {
              haptics.selection();
              setIsMuted((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            testID="btn-call-mute"
          >
            <Icon name={isMuted ? 'eyeOff' : 'mic'} size="md" color="#FFFFFF" />
          </TouchableOpacity>

          {/* Video Toggle */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              { backgroundColor: !isVideoOn ? 'rgba(255, 255, 255, 0.1)' : colors.accent },
            ]}
            onPress={() => {
              haptics.selection();
              setIsVideoOn((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
            testID="btn-call-video-toggle"
          >
            <Icon name="video" size="md" color="#FFFFFF" />
          </TouchableOpacity>

          {/* Speaker Toggle */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              { backgroundColor: isSpeakerOn ? colors.accent : 'rgba(255, 255, 255, 0.15)' },
            ]}
            onPress={() => {
              haptics.selection();
              setIsSpeakerOn((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
            testID="btn-call-speaker"
          >
            <Icon name="volume" size="md" color="#FFFFFF" />
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn, { backgroundColor: colors.error }]}
            onPress={() => {
              haptics.medium();
              onHangup();
            }}
            accessibilityRole="button"
            accessibilityLabel="End call"
            testID="btn-call-hangup"
          >
            <Icon name="phone" size="md" color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 32,
  },
  topInfo: {
    alignItems: 'center',
    paddingTop: 16,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(216, 67, 21, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    padding: 8,
    borderRadius: 72,
    borderWidth: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 24,
  },
  controlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallBtn: {
    transform: [{ rotate: '135deg' }],
  },
});
