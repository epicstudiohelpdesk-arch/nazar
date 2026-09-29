import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { CommunityDto } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface CommunityDetailScreenProps {
  readonly client: SocialApiClient;
  readonly communityId: string;
  readonly onOpenFeed?: (communityId: string) => void;
  readonly onBack?: () => void;
}

export function CommunityDetailScreen({
  client,
  communityId,
  onOpenFeed,
  onBack,
}: CommunityDetailScreenProps) {
  const [community, setCommunity] = useState<CommunityDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const loadCommunity = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await client.getCommunity(communityId);
      setCommunity(data);
    } catch (err: unknown) {
      console.error('Failed to load community:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, communityId]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const handleJoinOrLeave = async () => {
    if (!community) return;
    try {
      setIsActionLoading(true);
      if (community.currentUserMembershipStatus === 'ACTIVE') {
        await client.leaveCommunity(community.id);
        Alert.alert('Left Community', 'You have left this community.');
      } else {
        await client.joinCommunity(community.id);
        Alert.alert('Joined Community', 'You are now a member of this community.');
      }
      loadCommunity();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      Alert.alert('Error', msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading || !community) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isMember = community.currentUserMembershipStatus === 'ACTIVE';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{community.name}</Text>
        <Text style={styles.privacyBadge}>{community.privacy} COMMUNITY</Text>
        <Text style={styles.stats}>👥 {community.memberCount} Members</Text>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{community.description}</Text>

        {community.rules && community.rules.length > 0 ? (
          <View style={styles.rulesContainer}>
            <Text style={styles.sectionTitle}>Rules</Text>
            {community.rules.map((rule, idx) => (
              <Text key={idx} style={styles.ruleItem}>
                {idx + 1}. {rule}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.primaryBtn, isMember ? styles.leaveBtn : styles.joinBtn]}
            onPress={handleJoinOrLeave}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>{isMember ? 'Leave Community' : 'Join Community'}</Text>
            )}
          </TouchableOpacity>

          {isMember ? (
            <TouchableOpacity style={styles.feedBtn} onPress={() => onOpenFeed?.(community.id)}>
              <Text style={styles.feedBtnText}>View Community Feed →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
  content: {
    padding: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  privacyBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  stats: {
    fontSize: 14,
    color: '#3A3A3C',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    color: '#3A3A3C',
    lineHeight: 22,
  },
  rulesContainer: {
    marginTop: 16,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  ruleItem: {
    fontSize: 14,
    color: '#48484A',
    marginBottom: 4,
  },
  actionSection: {
    marginTop: 32,
    gap: 12,
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinBtn: {
    backgroundColor: '#34C759',
  },
  leaveBtn: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  feedBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  feedBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
