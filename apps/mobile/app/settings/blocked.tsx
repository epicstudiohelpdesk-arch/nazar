import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TextInput,
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
import { hashPhoneNumber } from '../../src/safety/phone-hash.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function BlockedUsersRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const safetyApi = getDefaultSafetyApi();

  const [activeTab, setActiveTab] = useState<'members' | 'contacts'>('members');
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isHashing, setIsHashing] = useState(false);

  const blocksQuery = useQuery({
    queryKey: SAFETY_QUERY_KEYS.blocks,
    queryFn: () => safetyApi.getBlockedUsers(),
  });

  const contactsQuery = useQuery({
    queryKey: SAFETY_QUERY_KEYS.blockedContacts,
    queryFn: () => safetyApi.listBlockedContacts(),
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

  const blockContactMutation = useMutation({
    mutationFn: (payload: { phoneHash: string; label?: string }) =>
      safetyApi.blockContacts({ contacts: [payload] }),
    onSuccess: () => {
      invalidateSafetyCaches(queryClient);
      setNewPhone('');
      setNewLabel('');
      Alert.alert('Contact Blocked', 'This contact has been blocked from your discovery feed.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to block contact';
      Alert.alert('Error', msg);
    },
  });

  const unblockContactMutation = useMutation({
    mutationFn: (phoneHash: string) => safetyApi.unblockContact(phoneHash),
    onSuccess: () => {
      invalidateSafetyCaches(queryClient);
      Alert.alert('Contact Unblocked', 'This contact has been removed from your blocklist.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to unblock contact';
      Alert.alert('Error', msg);
    },
  });

  const handleConfirmUnblock = (userId: string, displayName: string) => {
    haptics.impactLight();
    Alert.alert(
      'Unblock Member?',
      `Are you sure you want to unblock ${displayName}? They will be able to see your profile again in discovery and send messages if you match.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => {
            haptics.impactMedium();
            unblockMutation.mutate(userId);
          },
        },
      ]
    );
  };

  const handleAddBlockedContact = async () => {
    if (!newPhone.trim()) {
      haptics.notificationError();
      Alert.alert('Phone Number Required', 'Please enter a valid phone number to block.');
      return;
    }

    try {
      setIsHashing(true);
      const hash = await hashPhoneNumber(newPhone);
      if (!hash) {
        haptics.notificationError();
        Alert.alert('Invalid Number', 'Could not parse this phone number.');
        return;
      }
      haptics.impactMedium();
      blockContactMutation.mutate({
        phoneHash: hash,
        label: newLabel.trim() || undefined,
      });
    } catch (err: unknown) {
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : 'Could not hash phone number';
      Alert.alert('Error', msg);
    } finally {
      setIsHashing(false);
    }
  };

  const handleConfirmUnblockContact = (phoneHash: string, label?: string | null) => {
    haptics.impactLight();
    const contactName = label || `Contact ••• ${phoneHash.slice(-6)}`;
    Alert.alert(
      'Unblock Contact?',
      `Are you sure you want to unblock ${contactName}? They will be able to appear in discovery feeds.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => {
            haptics.impactMedium();
            unblockContactMutation.mutate(phoneHash);
          },
        },
      ]
    );
  };

  const blockedUsers = blocksQuery.data?.items ?? [];
  const blockedContacts = contactsQuery.data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Blocked Management"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/settings/safety');
          }
        }}
        leftAction="back"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented Tab Switch */}
        <View style={[styles.tabBar, { backgroundColor: theme.colors.surfaceMuted }]}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'members' && [
                styles.activeTabItem,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => {
              haptics.selection();
              setActiveTab('members');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'members' }}
            testID="tab-blocked-members"
          >
            <Text
              variant="label"
              weight="medium"
              color={activeTab === 'members' ? 'accent' : 'secondary'}
            >
              Members ({blockedUsers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'contacts' && [
                styles.activeTabItem,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => {
              haptics.selection();
              setActiveTab('contacts');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'contacts' }}
            testID="tab-blocked-contacts"
          >
            <Text
              variant="label"
              weight="medium"
              color={activeTab === 'contacts' ? 'accent' : 'secondary'}
            >
              Contacts ({blockedContacts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'members' ? (
          <>
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
                  Anyone you block from chats or discovery feeds will appear here. You can unblock
                  them at any time.
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
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Heading level="h2">Block Contacts</Heading>
              <Text level="bodySmall" color="secondary">
                Block acquaintances, colleagues, or ex-partners before they can ever see you. Phone
                numbers are hashed with SHA-256 locally on your phone so your raw address book is
                never uploaded.
              </Text>
            </View>

            {/* Add Contact Card */}
            <SurfaceCard elevation="sm" style={styles.addContactCard}>
              <Heading level="h3">Add Contact to Block</Heading>
              <View style={styles.inputGroup}>
                <Text level="caption" color="secondary">
                  Phone Number
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="phone-pad"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  testID="input-block-phone"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text level="caption" color="secondary">
                  Label (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  placeholder="e.g. Ex, Boss, Family"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={newLabel}
                  onChangeText={setNewLabel}
                  testID="input-block-label"
                />
              </View>

              <Button
                variant="primary"
                size="md"
                isLoading={isHashing || blockContactMutation.isPending}
                onPress={handleAddBlockedContact}
                testID="btn-block-contact"
              >
                Hash & Block Contact
              </Button>
            </SurfaceCard>

            {/* Blocked Contacts List */}
            {contactsQuery.isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
              </View>
            ) : blockedContacts.length === 0 ? (
              <SurfaceCard elevation="sm" style={styles.emptyCard}>
                <View style={[styles.emptyIconBox, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <Icon name="shield" size={24} color={theme.colors.textSecondary} />
                </View>
                <Heading level="h3">No Blocked Contacts</Heading>
                <Text level="bodySmall" color="secondary" style={styles.emptyText}>
                  Any phone numbers you block will be excluded from mutual discovery without
                  exposing your contact list.
                </Text>
              </SurfaceCard>
            ) : (
              <View style={styles.listContainer}>
                {blockedContacts.map((c) => (
                  <SurfaceCard key={c.id} elevation="sm" style={styles.userCard}>
                    <View style={styles.userRow}>
                      <View
                        style={[
                          styles.avatarPlaceholder,
                          { backgroundColor: theme.colors.surfaceMuted },
                        ]}
                      >
                        <Icon name="flag" size={18} color={theme.colors.accent} />
                      </View>

                      <View style={styles.userInfo}>
                        <Text level="title">{c.label || 'Blocked Contact'}</Text>
                        <Text level="caption" color="tertiary">
                          SHA-256: ••• {c.phoneHash.slice(-8)}
                        </Text>
                      </View>

                      <Button
                        variant="tertiary"
                        size="sm"
                        isLoading={
                          unblockContactMutation.isPending &&
                          unblockContactMutation.variables === c.phoneHash
                        }
                        onPress={() => handleConfirmUnblockContact(c.phoneHash, c.label)}
                        accessibilityLabel={`Unblock ${c.label || 'contact'}`}
                      >
                        Unblock
                      </Button>
                    </View>
                  </SurfaceCard>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabItem: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  addContactCard: {
    padding: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
