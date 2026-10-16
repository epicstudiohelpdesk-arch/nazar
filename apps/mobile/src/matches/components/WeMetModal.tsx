import React, { useState } from 'react';
import { Modal, View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import type { PostDateFeedbackRequestDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Button } from '../../design/components/button/Button.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import { Icon } from '../../design/primitives/Icon.js';
import { haptics } from '../../design/haptics/index.js';

export interface WeMetModalProps {
  readonly visible: boolean;
  readonly matchId: string;
  readonly partnerName: string;
  readonly onClose: () => void;
  readonly onSubmit: (feedback: PostDateFeedbackRequestDto) => Promise<void>;
  readonly isSubmitting?: boolean;
  readonly testID?: string;
}

const SENTIMENT_TAGS = [
  { id: 'GREAT_CONVERSATION', label: 'Great Conversation' },
  { id: 'GOOD_CHEMISTRY', label: 'Good Chemistry' },
  { id: 'KIND_RESPECTFUL', label: 'Kind & Respectful' },
  { id: 'LOOKED_DIFFERENT', label: 'Looked Different' },
  { id: 'FRIEND_VIBE', label: 'Felt Like Friends' },
  { id: 'NOT_MY_VIBE', label: 'Not My Vibe' },
] as const;

export const WeMetModal: React.FC<WeMetModalProps> = ({
  visible,
  matchId: _matchId,
  partnerName,
  onClose,
  onSubmit,
  isSubmitting = false,
  testID = 'we-met-modal',
}) => {
  const { colors, radii, spacing } = useTheme();
  const [didMeet, setDidMeet] = useState<boolean | null>(null);
  const [wouldSeeAgain, setWouldSeeAgain] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [closeMatch, setCloseMatch] = useState<boolean>(false);

  if (!visible) return null;

  const toggleTag = (tagId: string) => {
    haptics.selection();
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSelectDidMeet = (value: boolean) => {
    haptics.selection();
    setDidMeet(value);
    if (!value) {
      setWouldSeeAgain(null);
    }
  };

  const handleSelectWouldSeeAgain = (value: boolean) => {
    haptics.selection();
    setWouldSeeAgain(value);
  };

  const handleToggleCloseMatch = () => {
    haptics.selection();
    setCloseMatch((prev) => !prev);
  };

  const handleSubmit = async () => {
    if (didMeet === null) return;
    haptics.notificationSuccess();
    await onSubmit({
      didMeet,
      wouldSeeAgain: wouldSeeAgain ?? undefined,
      sentimentTags: selectedTags.length > 0 ? selectedTags : undefined,
      closeMatch,
    });
    onClose();
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
        <SurfaceCard elevation="lg" style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                <Icon name="sparkles" size="sm" color={colors.accent} />
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close feedback"
                style={styles.closeBtn}
              >
                <Icon name="close" size="sm" color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Heading level="h2" style={{ color: colors.textPrimary, marginBottom: spacing.xs }}>
              Did you meet {partnerName}?
            </Heading>
            <Text
              variant="bodySmall"
              style={{ color: colors.textSecondary, marginBottom: spacing.lg }}
            >
              Your answer is completely private and helps improve recommendations.
            </Text>

            {/* Question 1: Did you meet in person? */}
            <Text
              variant="label"
              weight="bold"
              style={{ color: colors.textPrimary, marginBottom: spacing.sm }}
            >
              Did you meet in person?
            </Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                onPress={() => handleSelectDidMeet(true)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: didMeet === true ? colors.accent : colors.surfaceMuted,
                    borderColor: didMeet === true ? colors.accent : colors.border,
                    borderRadius: radii.radiusMD,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Yes, we met"
              >
                <Text
                  variant="bodySmall"
                  weight="bold"
                  style={{ color: didMeet === true ? colors.textInverse : colors.textPrimary }}
                >
                  Yes, we met
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectDidMeet(false)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: didMeet === false ? colors.accent : colors.surfaceMuted,
                    borderColor: didMeet === false ? colors.accent : colors.border,
                    borderRadius: radii.radiusMD,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="No, not yet"
              >
                <Text
                  variant="bodySmall"
                  weight="bold"
                  style={{ color: didMeet === false ? colors.textInverse : colors.textPrimary }}
                >
                  No, not yet
                </Text>
              </TouchableOpacity>
            </View>

            {/* Conditional Sub-questions when met */}
            {didMeet === true && (
              <View style={{ marginTop: spacing.lg }}>
                <Text
                  variant="label"
                  weight="bold"
                  style={{ color: colors.textPrimary, marginBottom: spacing.sm }}
                >
                  Would you like to see {partnerName} again?
                </Text>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    onPress={() => handleSelectWouldSeeAgain(true)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor:
                          wouldSeeAgain === true ? colors.accent : colors.surfaceMuted,
                        borderColor: wouldSeeAgain === true ? colors.accent : colors.border,
                        borderRadius: radii.radiusMD,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Yes, would see again"
                  >
                    <Text
                      variant="bodySmall"
                      weight="bold"
                      style={{
                        color: wouldSeeAgain === true ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      Yes, definitely
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSelectWouldSeeAgain(false)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor:
                          wouldSeeAgain === false ? colors.accent : colors.surfaceMuted,
                        borderColor: wouldSeeAgain === false ? colors.accent : colors.border,
                        borderRadius: radii.radiusMD,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Not really"
                  >
                    <Text
                      variant="bodySmall"
                      weight="bold"
                      style={{
                        color: wouldSeeAgain === false ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      Not really
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Sentiment Tags */}
                <Text
                  variant="label"
                  weight="bold"
                  style={{
                    color: colors.textPrimary,
                    marginTop: spacing.md,
                    marginBottom: spacing.xs,
                  }}
                >
                  How was the date?
                </Text>
                <View style={styles.tagsContainer}>
                  {SENTIMENT_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => toggleTag(tag.id)}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: isSelected ? colors.accent : colors.surfaceMuted,
                            borderColor: isSelected ? colors.accent : colors.border,
                            borderRadius: radii.radiusFull,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Tag: ${tag.label}`}
                      >
                        <Text
                          variant="caption"
                          weight="medium"
                          style={{ color: isSelected ? colors.textInverse : colors.textPrimary }}
                        >
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Pruning / Close Match Option */}
            <TouchableOpacity
              onPress={handleToggleCloseMatch}
              style={[
                styles.pruneCheckboxRow,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.radiusMD,
                  marginTop: spacing.lg,
                  padding: spacing.md,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: closeMatch }}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: closeMatch ? colors.accent : colors.border,
                    backgroundColor: closeMatch ? colors.accent : 'transparent',
                  },
                ]}
              >
                {closeMatch && <Icon name="check" size="tiny" color="#FFFFFF" />}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySmall" weight="bold" style={{ color: colors.textPrimary }}>
                  Close this match
                </Text>
                <Text variant="caption" style={{ color: colors.textSecondary }}>
                  Free up a spot in your 5-match cap for new potential matches.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Submit Button */}
            <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              <Button
                variant="primary"
                size="md"
                label={isSubmitting ? 'Saving...' : 'Submit Feedback'}
                onPress={handleSubmit}
                disabled={didMeet === null || isSubmitting}
                testID="we-met-submit-btn"
              />
            </View>
          </ScrollView>
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
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dialog: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 24,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  pruneCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
