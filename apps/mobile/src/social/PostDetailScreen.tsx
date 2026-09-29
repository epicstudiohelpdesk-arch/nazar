import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { PostDto, PostCommentDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface PostDetailScreenProps {
  readonly client: SocialApiClient;
  readonly postId: string;
  readonly onBack?: () => void;
}

export function PostDetailScreen({ client, postId, onBack }: PostDetailScreenProps) {
  const [post, setPost] = useState<PostDto | null>(null);
  const [comments, setComments] = useState<PostCommentDto[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedPost, commentList] = await Promise.all([
        client.getPost(postId),
        client.getComments(postId, { limit: 50 }),
      ]);
      setPost(fetchedPost);
      setComments([...commentList.items]);
    } catch (err: unknown) {
      console.error('Failed to load post details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await client.addComment(postId, {
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, created]);
      setNewComment('');
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add comment';
      Alert.alert('Comment Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async () => {
    if (!post) return;
    try {
      if (post.userReaction) {
        await client.removeReaction(post.id, 'LIKE');
        setPost({
          ...post,
          userReaction: null,
          likeCount: Math.max(0, post.likeCount - 1),
        });
      } else {
        await client.addReaction(post.id, 'LIKE');
        setPost({
          ...post,
          userReaction: 'LIKE',
          likeCount: post.likeCount + 1,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to toggle like:', err);
    }
  };

  if (isLoading || !post) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderComment = ({ item }: { item: PostCommentDto }) => (
    <View style={styles.commentCard}>
      <Text style={styles.commentAuthor}>{item.author?.displayName || 'Nazar User'}</Text>
      <Text style={styles.commentBody}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={
          <View style={styles.postBodyContainer}>
            <Text style={styles.authorName}>{post.author?.displayName || 'Nazar User'}</Text>
            <Text style={styles.postContent}>{post.content}</Text>
            <View style={styles.postStats}>
              <TouchableOpacity onPress={handleToggleLike}>
                <Text style={post.userReaction ? styles.likedText : styles.statText}>
                  👍 {post.likeCount} Likes
                </Text>
              </TouchableOpacity>
              <Text style={styles.statText}>💬 {post.commentCount} Comments</Text>
            </View>
            <Text style={styles.commentsHeading}>Comments</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor="#8E8E93"
          value={newComment}
          onChangeText={setNewComment}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newComment.trim() && styles.disabledSend]}
          onPress={handleAddComment}
          disabled={isSubmitting || !newComment.trim()}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  postBodyContainer: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  authorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  likedText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  commentsHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 8,
  },
  commentCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
    color: '#1C1C1E',
  },
  commentBody: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  emptyComments: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  commentInputRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  disabledSend: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
