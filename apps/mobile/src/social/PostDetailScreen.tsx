import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type {
  PostDto,
  PostCommentDto,
  PostReactionType,
  ReportReasonCode,
  ReportTargetType,
} from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Heading } from '../design/primitives/Heading.js';
import { Avatar } from '../design/primitives/Avatar.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { SkeletonBox } from '../design/components/feedback/LoadingSkeleton.js';
import { SocialLoadMoreButton } from './components/SocialPostList.js';
import { ReportModal } from '../safety/components/ReportModal.js';
import { BlockModal } from '../safety/components/BlockModal.js';
import { createSafetyApi } from '../safety/safety-api.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { useProfileStore } from '../profile/profile-store.js';
import { type SocialApiClient, SOCIAL_QUERY_KEYS } from './social-api.js';
import { invalidateFeedLists } from './social-cache.js';
import {
  byId,
  describeSocialError,
  flattenPages,
  formatRelativeTime,
  getMutationErrorMessage,
  getNextCursorPageParam,
  getVisibilityLabel,
  isOwnedByViewer,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface PostDetailScreenProps {
  readonly client: SocialApiClient;
  readonly postId: string;
  readonly onBack?: () => void;
}

const COMMENT_PAGE_SIZE = 20;
const MAX_COMMENT_LENGTH = 1000;

/** The five reaction types the API accepts, in the order they are offered. */
const REACTION_OPTIONS: readonly { type: PostReactionType; label: string; icon: string }[] = [
  { type: 'LIKE', label: 'Like', icon: '\u{1F44D}' },
  { type: 'LOVE', label: 'Love', icon: '\u2764\uFE0F' },
  { type: 'CELEBRATE', label: 'Celebrate', icon: '\u{1F389}' },
  { type: 'SUPPORT', label: 'Support', icon: '\u{1F91D}' },
  { type: 'LAUGH', label: 'Laugh', icon: '\u{1F602}' },
];

/**
 * Post detail with comments, reactions, editing and safety actions.
 *
 * This is the only social surface where `userReaction` is authoritative:
 * `GET /v1/social/posts/:id` hydrates it, whereas feed DTOs always return null.
 * The reaction toggle therefore lives here and the feed never claims a reaction
 * the server did not report.
 */
export const PostDetailScreen: React.FC<PostDetailScreenProps> = ({ client, postId, onBack }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, radii, spacing } = useTheme();

  const [newComment, setNewComment] = useState('');
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);
  const [isReactionSheetVisible, setIsReactionSheetVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const authClient = useMemo(() => getDefaultAuthClient(), []);
  const safetyApi = useMemo(() => createSafetyApi(authClient), [authClient]);
  const currentUserId = useProfileStore((state) => state.profile?.userId ?? null);

  const {
    data: post,
    isLoading: isLoadingPost,
    isError: isPostError,
    error: postError,
    refetch: refetchPost,
  } = useQuery<PostDto>({
    queryKey: SOCIAL_QUERY_KEYS.post(postId),
    queryFn: () => client.getPost(postId),
    enabled: Boolean(postId),
  });

  const commentsQuery = useInfiniteQuery({
    queryKey: SOCIAL_QUERY_KEYS.comments(postId),
    queryFn: ({ pageParam }) =>
      client.getComments(postId, { limit: COMMENT_PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorPageParam,
    enabled: Boolean(postId),
  });

  const comments = useMemo(
    () => flattenPages(commentsQuery.data?.pages, byId) as PostCommentDto[],
    [commentsQuery.data]
  );

  useEffect(() => {
    if (post) trackOnboardingEvent('post_viewed', { post_id: post.id });
  }, [post]);

  const reactionMutation = useMutation({
    mutationFn: async ({ type, remove }: { type: PostReactionType; remove: boolean }) =>
      remove ? client.removeReaction(postId, type) : client.addReaction(postId, type),
    onSuccess: (_data, vars) => {
      // `post_liked` is a LIKE reaction; the other four types are tracked with
      // their own value rather than being reported as a like or an unlike.
      if (vars.remove) {
        trackOnboardingEvent('post_unliked', { post_id: postId });
      } else if (vars.type === 'LIKE') {
        trackOnboardingEvent('post_liked', { post_id: postId });
      } else {
        trackOnboardingEvent('post_reacted', { post_id: postId, reaction: vars.type });
      }
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.post(postId) });
      invalidateFeedLists(queryClient, post?.communityId ?? null);
      setIsReactionSheetVisible(false);
    },
    onError: (error, vars) => {
      trackOnboardingEvent('post_reaction_failed', {
        post_id: postId,
        reaction: vars.type,
        reason: getMutationErrorMessage(error),
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => client.addComment(postId, { content: text.trim() }),
    onSuccess: () => {
      setNewComment('');
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.post(postId) });
      trackOnboardingEvent('comment_created', { post_id: postId });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: (content: string) => client.updatePost(postId, { content: content.trim() }),
    onSuccess: () => {
      setIsEditing(false);
      trackOnboardingEvent('post_edited', { post_id: postId });
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.post(postId) });
      invalidateFeedLists(queryClient, post?.communityId ?? null);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: () => client.deletePost(postId),
    onSuccess: () => {
      trackOnboardingEvent('post_deleted', { post_id: postId });
      // A deleted post must disappear from every surface that shows it. Only the
      // feeds and this post are affected, so the invalidation stays targeted
      // rather than wiping the whole social cache.
      queryClient.removeQueries({ queryKey: SOCIAL_QUERY_KEYS.post(postId) });
      queryClient.removeQueries({ queryKey: SOCIAL_QUERY_KEYS.comments(postId) });
      invalidateFeedLists(queryClient, post?.communityId ?? null);
      if (onBack) onBack();
      else router.back();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => client.deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.post(postId) });
    },
  });

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.content.slice(0, 100)} on Nazar`,
        url: `https://nazar.app/post/${post.id}`,
      });
    } catch {
      // Native share sheet dismissed.
    }
  };

  const handleReport = async (data: {
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: ReportReasonCode;
    notes?: string;
  }) => {
    await safetyApi.createReport({
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      description: data.notes || null,
    });
    setIsReportModalVisible(false);
    trackOnboardingEvent('social_report_submitted', { targetType: data.targetType });
  };

  const handleBlockAuthor = async (targetUserId: string, reason?: string) => {
    await safetyApi.blockUser(targetUserId, { reason: reason ?? 'Blocked from a post' });
    setIsBlockModalVisible(false);
    trackOnboardingEvent('social_block_submitted', { source: 'post' });
    // The viewer's block changes what the feed and this post are allowed to
    // return, so the affected caches are refetched.
    invalidateFeedLists(queryClient, post?.communityId ?? null);
    if (onBack) onBack();
    else router.back();
  };

  if (isLoadingPost) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Post" onBack={onBack} />
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <SkeletonBox width="100%" height={120} radius="radiusMD" />
          <SkeletonBox width="100%" height={60} radius="radiusMD" />
        </View>
      </View>
    );
  }

  if (isPostError || !post) {
    const view = describeSocialError(postError);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopNavHeader title="Post" onBack={onBack} />
        <ErrorState
          type={view.stateType}
          title={view.title}
          message={view.message}
          onRetry={view.isRetryable ? () => void refetchPost() : undefined}
          testID="post-detail-error"
        />
      </View>
    );
  }

  // The DTO carries no `isOwnPost` flag, so ownership is resolved against the
  // signed-in user id held in the profile store.
  const isOwnPost = isOwnedByViewer(post.authorId, currentUserId);
  const currentReaction = post.userReaction ?? null;
  const canComment = newComment.trim().length > 0 && !addCommentMutation.isPending;

  const confirmDeletePost = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePostMutation.mutate() },
    ]);
  };

  const renderComment = ({ item }: { item: PostCommentDto }) => (
    <View
      style={[
        styles.commentItem,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.commentHeaderRow}>
        <TouchableOpacity
          style={styles.commentAuthorRow}
          onPress={() => router.push(`/profile/${item.authorId}`)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Comment by ${item.author?.displayName ?? 'a member'}`}
          accessibilityHint="Opens their profile"
        >
          <Avatar
            name={item.author?.displayName || 'Member'}
            uri={item.author?.avatarUrl ?? undefined}
            size="sm"
          />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text variant="caption" weight="semibold">
              {item.author?.displayName || 'Member'}
            </Text>
            <Text variant="caption" color="tertiary">
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        {/* The API allows the comment's author, the post's author, and community
            moderators to delete a comment. Only the first two are knowable from
            this DTO, and the server rejects anything else. */}
        {isOwnedByViewer(item.authorId, currentUserId) || isOwnPost ? (
          <Button
            label="Delete"
            variant="tertiary"
            size="sm"
            onPress={() =>
              Alert.alert('Delete comment?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteCommentMutation.mutate(item.id),
                },
              ])
            }
            accessibilityLabel="Delete this comment"
            testID={`comment-delete-${item.id}`}
          />
        ) : null}
      </View>

      <Text variant="body" style={[styles.commentText, { marginTop: spacing.xs }]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      testID="post-detail-screen"
    >
      <TopNavHeader
        title="Post"
        onBack={onBack}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={[styles.headerIconBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Share this post"
              testID="post-share-btn"
            >
              <Icon name="share" size="sm" color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsReportModalVisible(true)}
              style={[styles.headerIconBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Report this post"
              testID="post-report-btn"
            >
              <Icon name="flag" size="sm" color={colors.error} />
            </TouchableOpacity>
          </View>
        }
      />

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View
            style={[
              styles.postHeaderContainer,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                padding: spacing.md,
              },
            ]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`Post by ${post.author?.displayName ?? 'a member'}. ${post.content}`}
          >
            <TouchableOpacity
              style={styles.postAuthorRow}
              onPress={() => router.push(`/profile/${post.authorId}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Open ${post.author?.displayName ?? 'author'} profile`}
            >
              <Avatar
                name={post.author?.displayName || 'Member'}
                uri={post.author?.avatarUrl ?? undefined}
                size="md"
              />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text variant="body" weight="bold">
                  {post.author?.displayName || 'Nazar member'}
                </Text>
                <Text variant="caption" color="secondary">
                  {formatRelativeTime(post.createdAt)}
                  {post.communityName ? ` \u00b7 in ${post.communityName}` : ''}
                </Text>
              </View>
            </TouchableOpacity>

            {isEditing ? (
              <View style={{ marginTop: spacing.md }}>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      borderRadius: radii.radiusMD,
                      color: colors.textPrimary,
                      padding: spacing.md,
                    },
                  ]}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  maxLength={2000}
                  accessibilityLabel="Edit post content"
                  testID="post-edit-input"
                />
                {updatePostMutation.isError ? (
                  <Text
                    variant="caption"
                    color="error"
                    accessibilityRole="alert"
                    style={{ marginTop: 4 }}
                    testID="post-edit-error"
                  >
                    {getMutationErrorMessage(updatePostMutation.error)}
                  </Text>
                ) : null}
                <View style={styles.editActions}>
                  <Button
                    label="Cancel"
                    variant="tertiary"
                    size="sm"
                    onPress={() => {
                      setIsEditing(false);
                      setEditContent(post.content);
                    }}
                  />
                  <Button
                    label="Save"
                    variant="primary"
                    size="sm"
                    loading={updatePostMutation.isPending}
                    disabled={!editContent.trim() || updatePostMutation.isPending}
                    onPress={() => updatePostMutation.mutate(editContent)}
                    testID="post-edit-save"
                  />
                </View>
              </View>
            ) : (
              <Text variant="body" style={[styles.postMainText, { marginVertical: spacing.md }]}>
                {post.content}
              </Text>
            )}

            <View style={styles.visibilityRow}>
              <Text variant="caption" color="tertiary">
                {getVisibilityLabel(post.visibility)}
              </Text>
              {post.communityId ? (
                <TouchableOpacity
                  onPress={() => router.push(socialRoutes.community(post.communityId as string))}
                  accessibilityRole="button"
                  accessibilityLabel="Open the community this post belongs to"
                  testID="post-community-link"
                >
                  <Text variant="caption" weight="semibold" color="accent">
                    {post.communityName ?? 'View community'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={[
                styles.interactionBar,
                { borderTopColor: colors.border, paddingTop: spacing.sm },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.interactionBtn,
                  currentReaction && {
                    backgroundColor: colors.accentSoft,
                    borderRadius: radii.radiusFull,
                  },
                ]}
                onPress={() => setIsReactionSheetVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: !!currentReaction }}
                accessibilityLabel={
                  currentReaction
                    ? `You reacted ${currentReaction.toLowerCase()}. ${post.likeCount} reactions.`
                    : `React to this post. ${post.likeCount} reactions.`
                }
                accessibilityHint="Opens the reaction options"
                testID="post-reaction-btn"
              >
                <Text variant="body" weight="bold" color={currentReaction ? 'accent' : 'secondary'}>
                  {currentReaction
                    ? `${REACTION_OPTIONS.find((r) => r.type === currentReaction)?.icon ?? '\u{1F44D}'} ${post.likeCount}`
                    : `React \u00b7 ${post.likeCount}`}
                </Text>
              </TouchableOpacity>

              <View style={styles.interactionBtn}>
                <Text variant="body" weight="medium" color="secondary">
                  {post.commentCount} comments
                </Text>
              </View>
            </View>

            {isOwnPost ? (
              <View style={styles.ownerActions}>
                <Button
                  label="Edit"
                  variant="tertiary"
                  size="sm"
                  onPress={() => {
                    setEditContent(post.content);
                    setIsEditing(true);
                  }}
                  accessibilityHint="Edit your post"
                  testID="post-edit-btn"
                />
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  onPress={confirmDeletePost}
                  accessibilityHint="Permanently deletes your post"
                  testID="post-delete-btn"
                />
              </View>
            ) : (
              <View style={styles.ownerActions}>
                <Button
                  label="Block author"
                  variant="tertiary"
                  size="sm"
                  icon="lock"
                  onPress={() => setIsBlockModalVisible(true)}
                  accessibilityHint="Block this member and hide their content"
                  testID="post-block-author-btn"
                />
              </View>
            )}

            {addCommentMutation.isError ? (
              <Text
                variant="caption"
                color="error"
                accessibilityRole="alert"
                style={{ marginTop: spacing.sm }}
                testID="comment-error"
              >
                {getMutationErrorMessage(addCommentMutation.error)}
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.md }}>
              <Heading level="h3">Comments</Heading>
            </View>
          </View>
        }
        ListEmptyComponent={
          commentsQuery.isLoading ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : commentsQuery.isError ? (
            // A failed comment request must not be rendered as "no comments",
            // which would tell the viewer something the server never said.
            <ErrorState
              type={describeSocialError(commentsQuery.error).stateType}
              message={describeSocialError(commentsQuery.error).message}
              onRetry={() => void commentsQuery.refetch()}
              testID="comments-error"
            />
          ) : (
            <Text
              variant="body"
              color="secondary"
              align="center"
              style={{ padding: spacing.xl }}
              testID="comments-empty"
            >
              No comments yet.
            </Text>
          )
        }
        ListFooterComponent={
          <SocialLoadMoreButton
            hasMore={commentsQuery.hasNextPage}
            isFetching={commentsQuery.isFetchingNextPage}
            onPress={() => void commentsQuery.fetchNextPage()}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
            void commentsQuery.fetchNextPage();
          }
        }}
      />

      <View
        style={[
          styles.composerContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            padding: spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[
            styles.composerInput,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.radiusFull,
              color: colors.textPrimary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
          placeholder="Add a comment"
          placeholderTextColor={colors.textTertiary}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={MAX_COMMENT_LENGTH}
          accessibilityLabel="Write a comment"
          accessibilityHint={`Up to ${MAX_COMMENT_LENGTH} characters`}
          testID="comment-input"
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.accent,
              borderRadius: radii.radiusFull,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
            !canComment && styles.disabled,
          ]}
          onPress={() => canComment && addCommentMutation.mutate(newComment)}
          disabled={!canComment}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canComment }}
          accessibilityLabel="Send comment"
          testID="comment-send-btn"
        >
          {addCommentMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Icon name="send" size="sm" color={colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={isReactionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReactionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsReactionSheetVisible(false)}
          accessibilityLabel="Close reaction options"
          accessibilityRole="button"
        >
          <View
            style={[
              styles.reactionSheet,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.radiusLG,
                padding: spacing.md,
              },
            ]}
            accessibilityViewIsModal
            accessibilityRole="radiogroup"
          >
            <Text variant="title" style={{ marginBottom: spacing.sm }}>
              React to this post
            </Text>
            <View style={styles.reactionRow}>
              {REACTION_OPTIONS.map((option) => {
                const isSelected = currentReaction === option.type;
                return (
                  <TouchableOpacity
                    key={option.type}
                    style={[
                      styles.reactionOption,
                      {
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected ? colors.accentSoft : 'transparent',
                        borderRadius: radii.radiusFull,
                        padding: spacing.sm,
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={option.label}
                    testID={`reaction-${option.type.toLowerCase()}`}
                    onPress={() =>
                      reactionMutation.mutate({
                        type: option.type,
                        remove: isSelected,
                      })
                    }
                  >
                    <Text variant="body">{option.icon}</Text>
                    <Text variant="caption" color={isSelected ? 'accent' : 'secondary'}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Button
              label="Close"
              variant="tertiary"
              size="sm"
              fullWidth
              style={{ marginTop: spacing.md }}
              onPress={() => setIsReactionSheetVisible(false)}
              testID="reaction-sheet-close"
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ReportModal
        visible={isReportModalVisible}
        targetType="POST"
        targetId={post.id}
        targetName="Post"
        onSubmit={handleReport}
        onClose={() => setIsReportModalVisible(false)}
      />

      {!isOwnPost ? (
        <BlockModal
          visible={isBlockModalVisible}
          targetUserId={post.authorId}
          targetUserName={post.author?.displayName ?? 'this member'}
          onConfirm={handleBlockAuthor}
          onClose={() => setIsBlockModalVisible(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  postHeaderContainer: {
    borderBottomWidth: 1,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postMainText: {
    fontSize: 16,
    lineHeight: 24,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  interactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editInput: {
    minHeight: 100,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  commentItem: {
    borderBottomWidth: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reactionSheet: {
    paddingBottom: 32,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  reactionOption: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
  },
});
