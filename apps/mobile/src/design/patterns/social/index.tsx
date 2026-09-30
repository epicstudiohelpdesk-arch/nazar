import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { Avatar } from '../../primitives/Avatar.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- AUTHOR ROW ---
export interface AuthorRowProps {
  readonly name: string;
  readonly photoUri?: string | null;
  readonly timestamp?: string;
  readonly badge?: string;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const AuthorRow: React.FC<AuthorRowProps> = ({
  name,
  photoUri,
  timestamp,
  badge,
  onPress,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.authorRow, style]}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      <Avatar uri={photoUri} name={name} size="sm" />
      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="title" weight="semibold" style={{ color: colors.textPrimary }}>
            {name}
          </Text>
          {badge && (
            <View
              style={[
                styles.authorBadge,
                { backgroundColor: colors.accentSoft, borderRadius: radii.radiusFull, marginLeft: spacing.xs },
              ]}
            >
              <Text variant="caption" weight="bold" style={{ color: colors.accentStrong, fontSize: 10 }}>
                {badge}
              </Text>
            </View>
          )}
        </View>
        {timestamp && (
          <Text variant="caption" style={{ color: colors.textTertiary, marginTop: 1 }}>
            {timestamp}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// --- REACTION BUTTON ---
export interface ReactionButtonProps {
  readonly count: number;
  readonly isReacted?: boolean;
  readonly onReact: () => void;
  readonly disabled?: boolean;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  count,
  isReacted = false,
  onReact,
  disabled = false,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onReact}
      disabled={disabled}
      style={styles.reactionBtn}
      accessibilityRole="button"
      accessibilityLabel={`${count} reactions. ${isReacted ? 'You liked this' : 'Like post'}`}
    >
      <Icon
        name="heart"
        size="sm"
        color={isReacted ? colors.accent : colors.textTertiary}
      />
      <Text
        variant="caption"
        weight="semibold"
        style={{
          color: isReacted ? colors.accent : colors.textSecondary,
          marginLeft: 6,
        }}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
};

// --- SOCIAL MEDIA PREVIEW ---
export interface SocialMediaPreviewProps {
  readonly uri: string;
  readonly aspectRatio?: number;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const SocialMediaPreview: React.FC<SocialMediaPreviewProps> = ({
  uri,
  aspectRatio = 16 / 9,
  onPress,
  style,
}) => {
  const { radii, colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.mediaWrapper,
        {
          aspectRatio,
          borderRadius: radii.radiusMD,
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}
      activeOpacity={0.9}
    >
      <Image source={{ uri }} style={styles.fullMedia} resizeMode="cover" />
    </TouchableOpacity>
  );
};

// --- POST CARD ---
export interface PostCardProps {
  readonly id: string;
  readonly authorName: string;
  readonly authorPhoto?: string | null;
  readonly authorBadge?: string;
  readonly content: string;
  readonly mediaUrl?: string | null;
  readonly timestamp: string;
  readonly likesCount: number;
  readonly commentsCount: number;
  readonly isLiked?: boolean;
  readonly onLike: () => void;
  readonly onCommentPress?: () => void;
  readonly onAuthorPress?: () => void;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const PostCard: React.FC<PostCardProps> = ({
  authorName,
  authorPhoto,
  authorBadge,
  content,
  mediaUrl,
  timestamp,
  likesCount,
  commentsCount,
  isLiked = false,
  onLike,
  onCommentPress,
  onAuthorPress,
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <SurfaceCard
      p="md"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.postCard, style]}
    >
      <AuthorRow
        name={authorName}
        photoUri={authorPhoto}
        badge={authorBadge}
        timestamp={timestamp}
        onPress={onAuthorPress}
      />

      <Text
        variant="body"
        style={{ color: colors.textPrimary, marginVertical: spacing.sm, lineHeight: 22 }}
      >
        {content}
      </Text>

      {mediaUrl && (
        <SocialMediaPreview uri={mediaUrl} style={{ marginBottom: spacing.sm }} />
      )}

      {/* Action Footer (Reactions & Comments) */}
      <View style={[styles.footerRow, { borderTopColor: colors.border, paddingTop: spacing.xs }]}>
        <ReactionButton count={likesCount} isReacted={isLiked} onReact={onLike} />

        <TouchableOpacity
          onPress={onCommentPress}
          style={styles.commentTrigger}
          accessibilityRole="button"
          accessibilityLabel={`${commentsCount} comments`}
        >
          <Icon name="message" size="sm" color={colors.textTertiary} />
          <Text variant="caption" weight="medium" style={{ color: colors.textSecondary, marginLeft: 6 }}>
            {commentsCount}
          </Text>
        </TouchableOpacity>
      </View>
    </SurfaceCard>
  );
};

export const SocialPostCard = PostCard;

// --- COMMENT ROW ---
export interface CommentRowProps {
  readonly id: string;
  readonly authorName: string;
  readonly authorPhoto?: string | null;
  readonly content: string;
  readonly timestamp: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const CommentRow: React.FC<CommentRowProps> = ({
  authorName,
  authorPhoto,
  content,
  timestamp,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.commentRow, { paddingVertical: spacing.sm }, style]}>
      <Avatar uri={authorPhoto} name={authorName} size="xs" />
      <View style={[styles.commentBody, { marginLeft: spacing.sm }]}>
        <View style={styles.commentHeader}>
          <Text variant="title" weight="semibold" style={{ color: colors.textPrimary, fontSize: 13 }}>
            {authorName}
          </Text>
          <Text variant="caption" style={{ color: colors.textTertiary, fontSize: 11 }}>
            {timestamp}
          </Text>
        </View>
        <Text variant="bodySmall" style={{ color: colors.textPrimary, marginTop: 2 }}>
          {content}
        </Text>
      </View>
    </View>
  );
};

// --- COMMENT COMPOSER ---
export interface CommentComposerProps {
  readonly onSubmit: (text: string) => void;
  readonly placeholder?: string;
  readonly isSubmitting?: boolean;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  onSubmit,
  placeholder = 'Add a comment...',
  isSubmitting = false,
}) => {
  const { colors, radii, spacing } = useTheme();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim() || isSubmitting) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <View style={[styles.composerContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.composerInput,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.radiusFull,
            borderColor: colors.border,
            color: colors.textPrimary,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!text.trim() || isSubmitting}
        style={[
          styles.submitBtn,
          {
            backgroundColor: text.trim() ? colors.accent : colors.surfaceMuted,
            borderRadius: radii.radiusFull,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Post comment"
      >
        <Icon name="send" size="tiny" color={text.trim() ? colors.textInverse : colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  mediaWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  postCard: {
    width: '100%',
    marginVertical: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  commentTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    paddingVertical: 4,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    width: '100%',
  },
  composerInput: {
    flex: 1,
    height: 38,
    fontSize: 14,
    borderWidth: 1,
  },
  submitBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
