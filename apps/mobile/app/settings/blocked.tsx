import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import {
  getDefaultSafetyApi,
  SAFETY_QUERY_KEYS,
  invalidateSafetyCaches,
} from '../../src/safety/safety-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function BlockedUsersRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const safetyApi = getDefaultSafetyApi();

  const blocksQuery = useQuery({
    queryKey: SAFETY_QUERY_KEYS.blocks,
    queryFn: () => safetyApi.getBlockedUsers(),
  });

  useEffect(() => {
    trackOnboardingEvent('blocked_users_viewed');
  }, []);

  const unblockMutation = useMutation({
    mutationFn: (targetUserId: string) => safetyApi.unblockUser(targetUserId),
    onSuccess: (_data, targetUserId) => {
      invalidateSafetyCaches(queryClient);
      trackOnboardingEvent('user_unblocked', { targetUserId });
      Alert.alert('User Unblocked', 'The member has been unblocked.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to unblock user';
      Alert.alert('Error', msg);
    },
  });

  const handleConfirmUnblock = (userId: string, displayName: string) => {
    Alert.alert(
      'Unblock Member?',
      `Are you sure you want to unblock ${displayName}? They will be able to see your profile again in discovery and send messages if you match.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => unblockMutation.mutate(userId),
        },
      ]
    );
  };

  const blockedUsers = blocksQuery.data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Blocked Accounts" onBack={() => router.back()} leftAction="back" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Heading level="h2">Blocked Members</Heading>
          <Text level="bodySmall" color="secondary">
            Blocked members cannot see your profile, swipe on you, or send you messages.
          </Text>
        </View>

        {blocksQuery.isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : blockedUsers.length === 0 ? (
          <SurfaceCard elevation="sm" style={styles.emptyCard}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Icon name="shield" size={24} color={theme.colors.textSecondary} />
            </View>
            <Heading level="h3">No Blocked Members</Heading>
            <Text level="bodySmall" color="secondary" style={styles.emptyText}>
              Anyone you block from chats or discovery feeds will appear here. You can unblock them
              at any time.
            </Text>
          </SurfaceCard>
        ) : (
          <View style={styles.listContainer}>
            {blockedUsers.map((item) => {
              const name = item.displayName || `User #${item.blockedUserId.slice(0, 6)}`;
              return (
                <SurfaceCard key={item.blockedUserId} elevation="sm" style={styles.userCard}>
                  <View style={styles.userRow}>
                    {item.primaryPhotoUrl ? (
                      <Image source={{ uri: item.primaryPhotoUrl }} style={styles.avatar} />
                    ) : (
                      <View
                        style={[
                          styles.avatarPlaceholder,
                          { backgroundColor: theme.colors.surfaceMuted },
                        ]}
                      >
                        <Icon name="user" size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}

                    <View style={styles.userInfo}>
                      <Text level="title">{name}</Text>
                      <Text level="caption" color="tertiary">
                        Blocked on {new Date(item.blockedAt).toLocaleDateString()}
                      </Text>
                    </View>

                    <Button
                      variant="tertiary"
                      size="sm"
                      isLoading={
                        unblockMutation.isPending &&
                        unblockMutation.variables === item.blockedUserId
                      }
                      onPress={() => handleConfirmUnblock(item.blockedUserId, name)}
                      accessibilityLabel={`Unblock ${name}`}
                    >
                      Unblock
                    </Button>
                  </View>
                </SurfaceCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 6,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  listContainer: {
    gap: 12,
  },
  userCard: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
});
