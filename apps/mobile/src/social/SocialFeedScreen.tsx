import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import type { PostDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface SocialFeedScreenProps {
  readonly client: SocialApiClient;
  readonly onOpenPost?: (postId: string) => void;
  readonly onCreatePost?: () => void;
}

export function SocialFeedScreen({ client, onOpenPost, onCreatePost }: SocialFeedScreenProps) {
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadFeed = useCallback(
    async (refresh: boolean = false) => {
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        const cursor = refresh ? undefined : nextCursor || undefined;
        const res = await client.getFeed({ limit: 20, cursor });

        if (refresh) {
          setPosts([...res.items]);
        } else {
          setPosts((prev) => [...prev, ...res.items]);
        }

        setNextCursor(res.nextCursor || null);
        setHasMore(res.hasMore);
      } catch (err: unknown) {
        console.error('Failed to load social feed:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client, nextCursor]
  );

  useEffect(() => {
    loadFeed(true);
  }, [client]);

  const handleToggleLike = async (postId: string, currentReaction?: string | null) => {
    try {
      if (currentReaction) {
        await client.removeReaction(postId, 'LIKE');
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, userReaction: null, likeCount: Math.max(0, p.likeCount - 1) }
              : p
          )
        );
      } else {
        await client.addReaction(postId, 'LIKE');
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, userReaction: 'LIKE', likeCount: p.likeCount + 1 } : p
          )
        );
      }
    } catch (err: unknown) {
      console.error('Failed to toggle like:', err);
    }
  };

  const renderItem = ({ item }: { item: PostDto }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => onOpenPost?.(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.authorRow}>
        <Text style={styles.authorName}>{item.author?.displayName || 'Nazar User'}</Text>
        {item.communityName ? (
          <Text style={styles.communityTag}>in {item.communityName}</Text>
        ) : null}
      </View>
      <Text style={styles.content}>{item.content}</Text>
      <View style={styles.metaRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleLike(item.id, item.userReaction)}
        >
          <Text style={item.userReaction ? styles.likedText : styles.actionText}>
            👍 {item.likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onOpenPost?.(item.id)}>
          <Text style={styles.actionText}>💬 {item.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        {onCreatePost ? (
          <TouchableOpacity style={styles.createButton} onPress={onCreatePost}>
            <Text style={styles.createButtonText}>+ Post</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFeed(true)}
              tintColor="#007AFF"
            />
          }
          onEndReached={() => {
            if (hasMore && !isLoading && !isRefreshing) {
              loadFeed(false);
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1C1C1E',
  },
  communityTag: {
    marginLeft: 6,
    fontSize: 13,
    color: '#8E8E93',
  },
  content: {
    fontSize: 15,
    color: '#2C2C2E',
    lineHeight: 21,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  likedText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
  },
});
