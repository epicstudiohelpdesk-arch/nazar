import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../design/theme/index.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { Heading } from '../design/primitives/Heading.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from './profile-api.js';
import { useProfileStore } from './profile-store.js';
import { CompletenessCard } from './components/CompletenessCard.js';
import { MediaGrid } from './components/MediaGrid.js';
import { PreferencesView } from './components/PreferencesView.js';
import { PromptsList } from './components/PromptsList.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface ProfileOverviewScreenProps {
  readonly onEditPress?: () => void;
  readonly onPreviewPress?: () => void;
  readonly onUploadPhotoPress?: () => void;
}

export function ProfileOverviewScreen({
  onEditPress,
  onPreviewPress,
  onUploadPhotoPress,
}: ProfileOverviewScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const profileApi = getDefaultProfileApi();

  // Primary Queries
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.me,
    queryFn: () => profileApi.getMyProfile(),
  });

  const mediaQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.media,
    queryFn: () => profileApi.getMediaList(),
  });

  const promptsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myPrompts,
    queryFn: () => profileApi.getMyPrompts(),
  });

  const interestsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myInterests,
    queryFn: () => profileApi.getMyInterests(),
  });

  const preferencesQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.preferences,
    queryFn: () => profileApi.getPreferences(),
  });

  // Synchronize store when server data arrives
  useEffect(() => {
    if (profileQuery.data) {
      useProfileStore.getState().setProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (mediaQuery.data) {
      useProfileStore.getState().setMedia(mediaQuery.data);
    }
  }, [mediaQuery.data]);

  useEffect(() => {
    if (promptsQuery.data) {
      useProfileStore.getState().setPrompts(promptsQuery.data);
    }
  }, [promptsQuery.data]);

  useEffect(() => {
    if (interestsQuery.data) {
      useProfileStore.getState().setInterests(interestsQuery.data);
    }
  }, [interestsQuery.data]);

  useEffect(() => {
    if (preferencesQuery.data) {
      useProfileStore.getState().setPreferences(preferencesQuery.data);
    }
  }, [preferencesQuery.data]);

  // Track profile view
  useEffect(() => {
    trackOnboardingEvent('profile_viewed_self');
  }, []);

  // Mutations
  const activateMutation = useMutation({
    mutationFn: () => profileApi.activateProfile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      Alert.alert('Profile Active', 'Your profile is now visible in discovery feeds.');
      trackOnboardingEvent('profile_visibility_changed', { visibility: res.visibility });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to activate profile';
      Alert.alert('Activation Error', msg);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => profileApi.pauseProfile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      Alert.alert('Profile Paused', 'Your profile is paused and hidden from new discovery feeds.');
      trackOnboardingEvent('profile_visibility_changed', { visibility: res.visibility });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to pause profile';
      Alert.alert('Error', msg);
    },
  });

  const hideMutation = useMutation({
    mutationFn: () => profileApi.hideProfile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      Alert.alert('Profile Hidden', 'Your profile is completely hidden from discovery.');
      trackOnboardingEvent('profile_visibility_changed', { visibility: res.visibility });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to hide profile';
      Alert.alert('Error', msg);
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (mediaId: string) => profileApi.setPrimaryPhoto(mediaId),
    onSuccess: (updatedMedia) => {
      useProfileStore.getState().setMedia(updatedMedia);
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.media });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set primary photo';
      Alert.alert('Photo Error', msg);
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (mediaId: string) => profileApi.deleteMedia(mediaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.media });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete photo';
      Alert.alert('Delete Error', msg);
    },
  });

  const profile = profileQuery.data ?? useProfileStore.getState().profile;
  const media = mediaQuery.data ?? useProfileStore.getState().media;
  const prompts = promptsQuery.data ?? useProfileStore.getState().prompts;
  const interests = interestsQuery.data ?? useProfileStore.getState().interests;
  const preferences = preferencesQuery.data ?? useProfileStore.getState().preferences;

  const isLoading = profileQuery.isLoading && !profile;
  const isError = profileQuery.isError && !profile;

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Icon name="warning" size="lg" color={colors.error} />
        <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
          Unable to Load Profile
        </Heading>
        <Text level="body" color="secondary" style={styles.errorText}>
          {profileQuery.error?.message || 'Check your connection and try again.'}
        </Text>
        <Button
          variant="secondary"
          size="md"
          onPress={() => profileQuery.refetch()}
          style={{ marginTop: 16 }}
        >
          Retry
        </Button>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Heading level="h2">No Profile Found</Heading>
        <Text level="body" color="secondary" style={styles.errorText}>
          Complete your profile setup to start discovering connections.
        </Text>
        {onEditPress && (
          <Button variant="primary" size="md" onPress={onEditPress} style={{ marginTop: 16 }}>
            Create Profile
          </Button>
        )}
      </View>
    );
  }

  const isComplete = profile.completionStatus.missingRequired.length === 0;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header Card */}
      <SurfaceCard elevation="sm" style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Heading level="h2">
                {profile.displayName}, {profile.age}
              </Heading>
              {profile.visibility === 'ACTIVE' && (
                <View
                  style={[styles.activeDot, { backgroundColor: colors.success || '#10B981' }]}
                />
              )}
            </View>
            {profile.city && (
              <Text level="bodySmall" color="secondary" style={{ marginTop: 2 }}>
                📍 {profile.city}
              </Text>
            )}
          </View>

          <View style={styles.quickActions}>
            {onEditPress && (
              <Button
                variant="primary"
                size="sm"
                onPress={onEditPress}
                accessibilityLabel="Edit Profile"
                testID="profile-edit-btn"
              >
                Edit
              </Button>
            )}
            {onPreviewPress && (
              <Button
                variant="secondary"
                size="sm"
                onPress={onPreviewPress}
                accessibilityLabel="Preview Profile"
                testID="profile-preview-btn"
              >
                Preview
              </Button>
            )}
          </View>
        </View>

        {profile.bio && (
          <Text level="body" color="primary" style={styles.bioText}>
            {profile.bio}
          </Text>
        )}
      </SurfaceCard>

      {/* Completeness & Lifecycle Status */}
      <CompletenessCard completeness={profile.completionStatus} visibility={profile.visibility} />

      {/* Photos Grid */}
      <MediaGrid
        media={media}
        onUploadPress={onUploadPhotoPress || onEditPress}
        onSetPrimary={(mediaId) => setPrimaryMutation.mutate(mediaId)}
        onDeleteMedia={(mediaId) => {
          Alert.alert(
            'Delete Photo',
            'Are you sure you want to remove this photo from your profile?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deletePhotoMutation.mutate(mediaId),
              },
            ]
          );
        }}
      />

      {/* Interests */}
      {interests.length > 0 && (
        <SurfaceCard elevation="sm" style={styles.sectionCard}>
          <Heading level="h3" style={{ marginBottom: 10 }}>
            Passions & Interests ({interests.length})
          </Heading>
          <View style={styles.interestsWrap}>
            {interests.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.interestChip,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text level="bodySmall" weight="medium">
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      )}

      {/* Prompts */}
      <PromptsList prompts={prompts} />

      {/* Preferences Summary */}
      {preferences && <PreferencesView preferences={preferences} />}

      {/* Lifecycle Actions */}
      <View style={styles.actionContainer}>
        {profile.visibility === 'DRAFT' && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isComplete || activateMutation.isPending}
            isLoading={activateMutation.isPending}
            onPress={() => activateMutation.mutate()}
            testID="profile-activate-btn"
          >
            {isComplete ? 'Activate Profile in Discovery' : 'Complete Profile to Activate'}
          </Button>
        )}

        {profile.visibility === 'ACTIVE' && (
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                isLoading={pauseMutation.isPending}
                onPress={() => pauseMutation.mutate()}
                testID="profile-pause-btn"
              >
                Pause Profile
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                isLoading={hideMutation.isPending}
                onPress={() => hideMutation.mutate()}
                testID="profile-hide-btn"
              >
                Hide Profile
              </Button>
            </View>
          </View>
        )}

        {(profile.visibility === 'PAUSED' || profile.visibility === 'HIDDEN') && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={activateMutation.isPending}
            onPress={() => activateMutation.mutate()}
            testID="profile-resume-btn"
          >
            Resume in Discovery
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  headerCard: {
    padding: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bioText: {
    marginTop: 12,
    lineHeight: 22,
  },
  sectionCard: {
    padding: 16,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionContainer: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
