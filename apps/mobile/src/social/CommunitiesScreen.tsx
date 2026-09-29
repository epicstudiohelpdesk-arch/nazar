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
import type { CommunityDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface CommunitiesScreenProps {
  readonly client: SocialApiClient;
  readonly onSelectCommunity?: (communityId: string) => void;
  readonly onCreateCommunity?: () => void;
}

export function CommunitiesScreen({
  client,
  onSelectCommunity,
  onCreateCommunity,
}: CommunitiesScreenProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');
  const [myCommunities, setMyCommunities] = useState<CommunityDto[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<CommunityDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [userList, discoverList] = await Promise.all([
        client.getUserCommunities({ limit: 20 }),
        client.discoverCommunities({ limit: 20 }),
      ]);
      setMyCommunities([...userList.items]);
      setDiscoverCommunities([...discoverList.items]);
    } catch (err: unknown) {
      console.error('Failed to load communities:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (communityId: string) => {
    try {
      const res = await client.joinCommunity(communityId);
      if (res.status === 'ACTIVE') {
        loadData();
      }
    } catch (err: unknown) {
      console.error('Failed to join community:', err);
    }
  };

  const renderCommunityCard = ({ item }: { item: CommunityDto }) => {
    const isMember = myCommunities.some((c) => c.id === item.id);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectCommunity?.(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityDesc} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.memberCount}>
            👥 {item.memberCount} members · {item.privacy}
          </Text>
        </View>

        {!isMember && activeTab === 'discover' ? (
          <TouchableOpacity style={styles.joinButton} onPress={() => handleJoin(item.id)}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const currentList = activeTab === 'my' ? myCommunities : discoverCommunities;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Communities</Text>
        {onCreateCommunity ? (
          <TouchableOpacity style={styles.createBtn} onPress={onCreateCommunity}>
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
            My Communities
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && currentList.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={renderCommunityCard}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadData();
              }}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'my'
                  ? 'You haven’t joined any communities yet.'
                  : 'No communities available to discover.'}
              </Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  communityDesc: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 18,
    marginBottom: 6,
  },
  memberCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  joinButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 12,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
  },
});
