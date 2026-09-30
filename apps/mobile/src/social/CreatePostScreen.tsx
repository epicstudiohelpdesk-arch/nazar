import React, { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostDto, PostVisibility } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { type SocialApiClient } from './social-api.js';
import { invalidateFeedLists } from './social-cache.js';
import {
  getMutationErrorMessage,
  getSocialErrorCode,
  getSocialFieldErrors,
  getVisibilityHint,
  getVisibilityLabel,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CreatePostScreenProps {
  readonly client: SocialApiClient;
  /** Set when composing inside a community; locks visibility to COMMUNITY. */
  readonly communityId?: string;
  readonly communityName?: string;
  readonly onPostCreated?: (post: PostDto) => void;
  readonly onCancel?: () => void;
}

const MAX_CONTENT_LENGTH = 2000;

const VISIBILITY_OPTIONS: readonly { key: PostVisibility; hint: string }[] = [
  { key: 'PUBLIC', hint: 'Anyone on Nazar can see this post.' },
  { key: 'COMMUNITY', hint: 'Only members of the community can see this post.' },
  { key: 'FOLLOWERS', hint: 'Only people you have connected with can see this post.' },
];

/**
 * Post composer.
 *
 * Error handling notes:
 * - Failures render inline instead of in a native `Alert`. The previous version
 *   put `err.message` in an alert, which surfaced raw server strings.
 * - Server field errors (`VALIDATION_ERROR` details) are mapped onto the
 *   corresponding field so the message lands next to the input that caused it.
 * - The character limit is enforced client-side for feedback only; the server
 *   re-validates and its message wins if the two ever disagree.
 *
 * Media attachments are intentionally absent: the mobile app has no media upload
 * client (no presigned-URL flow is wired), and `createPost` only accepts
 * `mediaIds` returned by that flow. This is recorded as a known gap in
 * `docs/frontend/social-architecture.md` rather than shipping a button that
 * cannot work.
 */
export const CreatePostScreen: React.FC<CreatePostScreenProps> = ({
  client,
  communityId,
  communityName,
  onPostCreated,
  onCancel,
}) => {
  const queryClient = useQueryClient();
  const { colors, radii, spacing } = useTheme();

  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>(
    communityId ? 'COMMUNITY' : 'PUBLIC'
  );

  const createPostMutation = useMutation({
    mutationFn: () =>
      client.createPost({
        content: content.trim(),
        communityId: communityId || null,
        visibility,
      }),
    onSuccess: (post) => {
      // A new post belongs at the top of both feeds, so invalidate rather than
      // patching: server ordering must decide where it lands.
      invalidateFeedLists(queryClient, communityId);
      trackOnboardingEvent('post_created', {
        post_id: post.id,
        has_community: Boolean(communityId),
        visibility,
      });
      onPostCreated?.(post);
    },
  });

  const fieldErrors = useMemo(
    () => getSocialFieldErrors(createPostMutation.error),
    [createPostMutation.error]
  );

  const trimmedLength = content.trim().length;
  const isOverLimit = content.length > MAX_CONTENT_LENGTH;
  const canPublish = trimmedLength > 0 && !isOverLimit && !createPostMutation.isPending;

  const serverCode = getSocialErrorCode(createPostMutation.error);
  const isMembershipError =
    serverCode === 'COMMUNITY_ACCESS_DENIED' || serverCode === 'COMMUNITY_MEMBER_BANNED';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="create-post-screen"
    >
      <TopNavHeader
        title="New post"
        onBack={onCancel}
        rightAction={
          <Button
            label={createPostMutation.isPending ? 'Posting' : 'Post'}
            variant="primary"
            size="sm"
            disabled={!canPublish}
            loading={createPostMutation.isPending}
            onPress={() => {
              trackOnboardingEvent('post_create_attempted', {
                has_community: Boolean(communityId),
                visibility,
              });
              createPostMutation.mutate();
            }}
            accessibilityHint="Publishes your post"
            testID="create-post-submit"
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { padding: spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        {communityId ? (
          <View
            style={[
              styles.contextRow,
              {
                backgroundColor: colors.accentSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.sm,
                marginBottom: spacing.sm,
              },
            ]}
            accessibilityRole="summary"
            accessibilityLabel={`Posting in ${communityName ?? 'this community'}`}
            testID="create-post-context"
          >
            <Icon name="sparkle" size="sm" color={colors.accentStrong} />
            <Text variant="caption" color="accent" style={{ marginLeft: 6, flex: 1 }}>
              Posting in {communityName ?? 'this community'}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: isOverLimit || fieldErrors.content ? colors.error : colors.border,
              borderRadius: radii.radiusMD,
              padding: spacing.md,
            },
          ]}
          placeholder="Share something with the community"
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus
          value={content}
          onChangeText={setContent}
          maxLength={MAX_CONTENT_LENGTH + 100}
          accessibilityLabel="Post content"
          accessibilityHint={`Up to ${MAX_CONTENT_LENGTH} characters`}
          testID="create-post-input"
        />

        <View style={styles.metaRow}>
          <Text variant="caption" color="tertiary" testID="create-post-media-note">
            {communityName
              ? `Posting to ${communityName}`
              : communityId
                ? 'Community post'
                : 'Text only'}
          </Text>
          <Text
            variant="caption"
            color={isOverLimit ? 'error' : 'tertiary'}
            accessibilityLabel={`${content.length} of ${MAX_CONTENT_LENGTH} characters used`}
          >
            {content.length} / {MAX_CONTENT_LENGTH}
          </Text>
        </View>

        {isOverLimit ? (
          <Text variant="caption" color="error" style={{ marginTop: 4 }}>
            Your post is longer than the {MAX_CONTENT_LENGTH} character limit.
          </Text>
        ) : null}
        {fieldErrors.content ? (
          <Text
            variant="caption"
            color="error"
            style={{ marginTop: 4 }}
            accessibilityRole="alert"
            testID="create-post-content-error"
          >
            {fieldErrors.content?.message}
          </Text>
        ) : null}

        {createPostMutation.isError ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.errorSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.sm,
                marginTop: spacing.md,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="create-post-error"
          >
            <Icon name="alertCircle" size="sm" color={colors.error} />
            <View style={{ marginLeft: 6, flex: 1 }}>
              <Text variant="caption" color="error">
                {getMutationErrorMessage(createPostMutation.error)}
              </Text>
              {isMembershipError ? (
                <Button
                  label="View community"
                  variant="tertiary"
                  size="sm"
                  style={{ marginTop: 6 }}
                  onPress={() => onCancel?.()}
                  testID="create-post-membership-help"
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.visibilityCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.radiusMD,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text variant="caption" weight="semibold" color="secondary">
            WHO CAN SEE THIS
          </Text>

          <View style={styles.visibilityOptions}>
            {VISIBILITY_OPTIONS.map((option) => {
              // The API accepts any visibility for a community post, so the
              // composer does not lock the audience to the community. It only
              // defaults to `COMMUNITY` when composing inside one.
              const isSelected = visibility === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.visibilityChip,
                    {
                      borderColor: isSelected ? colors.accent : colors.border,
                      backgroundColor: isSelected ? colors.accentSoft : colors.surfaceMuted,
                      borderRadius: radii.radiusFull,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                    },
                  ]}
                  onPress={() => setVisibility(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={getVisibilityLabel(option.key)}
                  accessibilityHint={option.hint}
                  testID={`create-post-visibility-${option.key.toLowerCase()}`}
                >
                  <Text
                    variant="caption"
                    weight={isSelected ? 'bold' : 'medium'}
                    color={isSelected ? 'accent' : 'secondary'}
                  >
                    {getVisibilityLabel(option.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text variant="caption" color="tertiary" style={{ marginTop: spacing.xs }}>
            {getVisibilityHint(visibility)}
          </Text>
        </View>

        <Button
          label="Cancel"
          variant="tertiary"
          size="sm"
          fullWidth
          style={{ marginTop: spacing.lg }}
          onPress={() => onCancel?.()}
          accessibilityHint="Discards this draft and returns to the previous screen"
          testID="create-post-cancel"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
  },
  textInput: {
    minHeight: 180,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityCard: {
    borderWidth: 1,
  },
  visibilityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  visibilityChip: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.45,
  },
});
