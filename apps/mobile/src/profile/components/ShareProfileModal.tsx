import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ShareableProfileCardDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Icon } from '../../design/primitives/Icon.js';
import { Badge } from '../../design/primitives/Badge.js';
import { Button } from '../../design/components/button/Button.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../profile-api.js';

export interface ShareProfileModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly profileId: string;
  readonly initialCard?: ShareableProfileCardDto;
}

export const ShareProfileModal: React.FC<ShareProfileModalProps> = ({
  visible,
  onClose,
  profileId,
  initialCard,
}) => {
  const { colors, radii, spacing } = useTheme();
  const profileApi = getDefaultProfileApi();
  const [copied, setCopied] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: PROFILE_QUERY_KEYS.shareCard(profileId),
    queryFn: () => profileApi.getShareableProfileCard(profileId),
    initialData: initialCard,
    enabled: visible && !!profileId,
  });

  const handleShare = async () => {
    if (!card) return;
    try {
      const shareUrl = card.shareUrl || `https://nazar.app/p/${card.profileId}`;
      const message = card.featuredPrompt
        ? `Check out ${card.displayName}, ${card.age} on Nazar: "${card.featuredPrompt.answer}" • ${shareUrl}`
        : `Check out ${card.displayName}, ${card.age} on Nazar: ${shareUrl}`;

      await Share.share({
        title: `${card.displayName} on Nazar`,
        message,
        url: shareUrl,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleCopyLink = () => {
    if (!card) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="share-profile-modal"
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderTopLeftRadius: radii.radiusXL,
              borderTopRightRadius: radii.radiusXL,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Heading level="h3" color={colors.textPrimary}>
              Share Profile
            </Heading>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close share modal"
              style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
              testID="close-share-modal"
            >
              <Icon name="close" size="sm" color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading && !card ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text variant="caption" color="secondary" style={{ marginTop: spacing.sm }}>
                Generating shareable card...
              </Text>
            </View>
          ) : card ? (
            <View style={styles.content}>
              {/* Profile Card Preview */}
              <View
                style={[
                  styles.cardPreview,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.radiusLG,
                  },
                ]}
                testID="share-card-preview"
              >
                {card.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: card.primaryPhotoUrl }}
                    style={[
                      styles.cardPhoto,
                      {
                        borderTopLeftRadius: radii.radiusLG,
                        borderTopRightRadius: radii.radiusLG,
                      },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.cardPhotoPlaceholder,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderTopLeftRadius: radii.radiusLG,
                        borderTopRightRadius: radii.radiusLG,
                      },
                    ]}
                  >
                    <Icon name="user" size="lg" color={colors.textTertiary} />
                  </View>
                )}

                <View style={{ padding: spacing.md }}>
                  <View style={styles.nameRow}>
                    <Text variant="bodyLarge" weight="bold" color="primary">
                      {card.displayName}, {card.age}
                    </Text>
                    {card.isVerified ? (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.info }]}>
                        <Icon name="check" size="tiny" color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    ) : null}
                  </View>

                  {card.city ? (
                    <View style={styles.cityRow}>
                      <Icon
                        name="location"
                        size="tiny"
                        color={colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text variant="caption" color="secondary">
                        {card.city}
                        {card.countryCode ? `, ${card.countryCode}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {card.eventPlusOne ? (
                    <View style={{ marginTop: spacing.xs }}>
                      <Badge
                        label={`🎟️ Seeking +1: ${card.eventPlusOne.eventTitle}`}
                        variant="accent"
                        size="sm"
                      />
                    </View>
                  ) : null}

                  {card.featuredPrompt ? (
                    <View
                      style={[
                        styles.promptBubble,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderRadius: radii.radiusSM,
                          padding: spacing.sm,
                          marginTop: spacing.sm,
                        },
                      ]}
                    >
                      <Text variant="caption" weight="bold" color="accent">
                        {card.featuredPrompt.prompt}
                      </Text>
                      <Text
                        variant="bodySmall"
                        color="primary"
                        style={{ fontStyle: 'italic', marginTop: 2 }}
                      >
                        "{card.featuredPrompt.answer}"
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.brandingRow}>
                    <Text variant="caption" color="tertiary">
                      ✨ Nazar Dating
                    </Text>
                    <Text variant="caption" color="tertiary">
                      nazar.app
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Button
                  label="Share via..."
                  onPress={handleShare}
                  variant="primary"
                  fullWidth
                  testID="share-action-btn"
                />

                <Button
                  label={copied ? 'Link Copied! ✓' : 'Copy Profile Link'}
                  onPress={handleCopyLink}
                  variant="secondary"
                  fullWidth
                  style={{ marginTop: spacing.sm }}
                  testID="copy-link-btn"
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
  },
  cardPreview: {
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPhoto: {
    width: '100%',
    height: 220,
  },
  cardPhotoPlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  promptBubble: {
    borderLeftWidth: 3,
    borderLeftColor: '#D84315',
  },
  brandingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  actions: {
    width: '100%',
    marginTop: 20,
  },
});
