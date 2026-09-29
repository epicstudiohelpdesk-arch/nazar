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

export interface CommunityFeedScreenProps {
  readonly client: SocialApiClient;
  readonly communityId: string;
  readonly onOpenPost?: (postId: string) => void;
  readonly onCreatePost?: () => void;
  readonly onBack?: () => void;
}

export function CommunityFeedScreen({
  client,
  communityId,
  onOpenPost,
  onCreatePost,
  onBack,
}: CommunityFeedScreenProps) {
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
        const res = await client.getCommunityFeed(communityId, { limit: 20, cursor });

        if (refresh) {
          setPosts([...res.items]);
        } else {
          setPosts((prev) => [...prev, ...res.items]);
        }

        setNextCursor(res.nextCursor || null);
        setHasMore(res.hasMore);
      } catch (err: unknown) {
        console.error('Failed to load community feed:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client, communityId, nextCursor]
  );

  useEffect(() => {
    loadFeed(true);
  }, [communityId]);

  const renderItem = ({ item }: { item: PostDto }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => onOpenPost?.(item.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.authorName}>{item.author?.displayName || 'Nazar User'}</Text>
      <Text style={styles.content}>{item.content}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.statText}>👍 {item.likeCount}</Text>
        <Text style={styles.statText}>💬 {item.commentCount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Feed</Text>
        {onCreatePost ? (
          <TouchableOpacity style={styles.createBtn} onPress={onCreatePost}>
            <Text style={styles.createBtnText}>+ Post</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {isLoading && posts.length === 0 ? (
        <View style={styles.centerContainer}>
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No community posts yet. Start the discussion!</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
  createBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  centerContainer: {
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
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  authorName: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 6,
  },
  content: {
    fontSize: 15,
    color: '#2C2C2E',
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  statText: {
    fontSize: 13,
    color: '#8E8E93',
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
