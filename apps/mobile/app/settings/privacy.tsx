import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../../src/profile/profile-api.js';
import { WorkModeOverlay } from '../../src/common/components/WorkModeOverlay.js';
import { PassportModal } from '../../src/profile/components/PassportModal.js';
import { useEntitlements } from '../../src/billing/useEntitlements.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

export default function PrivacySettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const profileApi = getDefaultProfileApi();
  const { hasPremium } = useEntitlements();

  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.me,
    queryFn: () => profileApi.getMyProfile(),
  });

  const profile = profileQuery.data;
  const isVisibleInDiscovery = profile?.visibility === 'ACTIVE';

  const [isWorkModeVisible, setIsWorkModeVisible] = useState(false);
  const [isPassportModalVisible, setIsPassportModalVisible] = useState(false);

  const passportQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.passport,
    queryFn: () => profileApi.getPassportLocation(),
  });

  const savePassportMutation = useMutation({
    mutationFn: (payload: {
      enabled: boolean;
      latitude?: number | null;
      longitude?: number | null;
      city?: string | null;
      country?: string | null;
    }) => profileApi.setPassportLocation(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.passport });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update Passport destination';
      Alert.alert('Passport Error', msg);
    },
  });

  useEffect(() => {
    trackOnboardingEvent('privacy_viewed');
  }, []);

  const incognitoMutation = useMutation({
    mutationFn: (enabled: boolean) => profileApi.updateMyProfile({ incognitoMode: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update Incognito mode';
      Alert.alert('Update Failed', msg);
    },
  });

  // Mutations
  const activateMutation = useMutation({
    mutationFn: () => profileApi.activateProfile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      trackOnboardingEvent('profile_visibility_changed', { visibility: res.visibility });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to activate profile';
      Alert.alert('Activation Failed', msg);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => profileApi.pauseProfile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      trackOnboardingEvent('profile_visibility_changed', { visibility: res.visibility });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to pause profile';
      Alert.alert('Action Failed', msg);
    },
  });

  const handleDiscoveryToggle = (nextValue: boolean) => {
    haptics.selection();
    if (nextValue) {
      if (profile?.completionStatus && profile.completionStatus.missingRequired.length > 0) {
        haptics.notificationWarning();
        Alert.alert(
          'Incomplete Profile',
          'Please upload at least 1 photo and fill in required fields before appearing in discovery feeds.',
          [
            { text: 'Edit Profile', onPress: () => router.push('/profile/edit') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
      activateMutation.mutate();
    } else {
      pauseMutation.mutate();
    }
  };

  const handleIncognitoToggle = (nextValue: boolean) => {
    haptics.selection();
    if (!hasPremium) {
      haptics.notificationWarning();
      Alert.alert(
        'Nazar Gold Feature',
        'Incognito Mode allows you to browse completely privately—only members you personally like can see your profile.',
        [
          { text: 'Upgrade to Gold', onPress: () => router.push('/billing') },
          { text: 'Maybe Later', style: 'cancel' },
        ]
      );
      return;
    }
    incognitoMutation.mutate(nextValue);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Privacy Controls"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/settings');
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
        {/* Discovery Visibility */}
        <View style={styles.section}>
          <Heading level="h3">Discovery Visibility</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Show Me in Discovery</Text>
                <Text level="bodySmall" color="secondary">
                  While turned off, your profile will be paused and hidden from candidate feeds.
                  Existing matches can still chat with you.
                </Text>
              </View>
              <Switch
                value={isVisibleInDiscovery}
                onValueChange={handleDiscoveryToggle}
                disabled={activateMutation.isPending || pauseMutation.isPending}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.switchRow}>
              <View style={styles.textCol}>
                <Text level="title">Incognito Mode</Text>
                <Text level="bodySmall" color="secondary">
                  Only be visible to members you have personally swiped right on. (Nazar Gold)
                </Text>
              </View>
              <Switch
                value={profile?.incognitoMode ?? false}
                onValueChange={handleIncognitoToggle}
                disabled={incognitoMutation.isPending}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              />
            </View>
          </SurfaceCard>
        </View>

        {/* Work Mode & Discreet Browsing */}
        <View style={styles.section}>
          <Heading level="h3">Work Mode & Discreet Browsing</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => setIsWorkModeVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Preview Work Mode Disguise"
            >
              <View style={{ flex: 1 }}>
                <Text level="title">Discreet Spreadsheet Disguise</Text>
                <Text level="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                  Instantly masks dating UI with a realistic financial spreadsheet view when
                  browsing in public or at work.
                </Text>
              </View>
              <Icon name="eyeOff" size={18} color={theme.colors.accent} />
            </TouchableOpacity>
          </SurfaceCard>
        </View>

        {/* Location Privacy */}
        <View style={styles.section}>
          <Heading level="h3">Location Privacy</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <View style={styles.infoRow}>
              <Icon name="shield" size={20} color={theme.colors.accent} />
              <View style={{ flex: 1 }}>
                <Text level="title">Coarse Distance Calculations</Text>
                <Text level="bodySmall" color="secondary" style={{ marginTop: 4 }}>
                  Nazar never reveals your exact GPS coordinates to other members. Distance metrics
                  are calculated server-side and presented as an approximate radius.
                </Text>
              </View>
            </View>
          </SurfaceCard>
        </View>

        {/* Passport & Travel Mode (Feature 3.3) */}
        <View style={styles.section}>
          <Heading level="h3">Passport & Travel Mode</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => setIsPassportModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Configure Passport Travel Mode"
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text level="title">Passport Location</Text>
                  {passportQuery.data?.enabled && (
                    <View
                      style={{
                        backgroundColor: theme.colors.accentSoft,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginLeft: 8,
                      }}
                    >
                      <Text
                        level="caption"
                        style={{ color: theme.colors.accent, fontWeight: '700' }}
                      >
                        ACTIVE
                      </Text>
                    </View>
                  )}
                </View>
                <Text level="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                  {passportQuery.data?.enabled && passportQuery.data?.city
                    ? `Currently swiping in ${passportQuery.data.city}${passportQuery.data.country ? `, ${passportQuery.data.country}` : ''}`
                    : 'Match with members in other cities before traveling.'}
                </Text>
              </View>
              <Icon name="chevron" size={18} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </SurfaceCard>
        </View>

        {/* Blocked Accounts Management */}
        <View style={styles.section}>
          <Heading level="h3">Safety Boundaries</Heading>
          <SurfaceCard elevation="sm" style={styles.card}>
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => router.push('/settings/blocked')}
              accessibilityRole="button"
              accessibilityLabel="Manage Blocked Accounts"
            >
              <View style={{ flex: 1 }}>
                <Text level="title">Blocked Accounts</Text>
                <Text level="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                  View and manage accounts you have blocked from contacting you.
                </Text>
              </View>
              <Icon name="chevron" size={18} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </SurfaceCard>
        </View>
      </ScrollView>

      {/* Passport Modal */}
      <PassportModal
        visible={isPassportModalVisible}
        onClose={() => setIsPassportModalVisible(false)}
        currentPassport={passportQuery.data}
        onSavePassport={async (payload) => {
          await savePassportMutation.mutateAsync(payload);
        }}
        isSaving={savePassportMutation.isPending}
      />

      {/* Work Mode Overlay Disguise */}
      <WorkModeOverlay visible={isWorkModeVisible} onClose={() => setIsWorkModeVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  card: {
    padding: 16,
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: 1,
  },
});
