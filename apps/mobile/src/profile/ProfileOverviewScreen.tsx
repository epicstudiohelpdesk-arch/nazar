import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useProfileStore } from './profile-store.js';
import { CompletenessCard } from './components/CompletenessCard.js';
import { MediaGrid } from './components/MediaGrid.js';
import { PreferencesView } from './components/PreferencesView.js';
import { PromptsList } from './components/PromptsList.js';

interface ProfileOverviewScreenProps {
  onActivatePress?: () => void;
  onPausePress?: () => void;
  onHidePress?: () => void;
  onEditPress?: () => void;
  onUploadPhotoPress?: () => void;
  onSetPrimaryPhoto?: (mediaId: string) => void;
  onDeletePhoto?: (mediaId: string) => void;
}

export const ProfileOverviewScreen: React.FC<ProfileOverviewScreenProps> = ({
  onActivatePress,
  onPausePress,
  onHidePress,
  onEditPress,
  onUploadPhotoPress,
  onSetPrimaryPhoto,
  onDeletePhoto,
}) => {
  const profile = useProfileStore((state) => state.profile);
  const preferences = useProfileStore((state) => state.preferences);
  const prompts = useProfileStore((state) => state.prompts);
  const media = useProfileStore((state) => state.media);

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>No profile found. Create your dating profile.</Text>
        {onEditPress && (
          <TouchableOpacity style={styles.primaryButton} onPress={onEditPress}>
            <Text style={styles.primaryButtonText}>Create Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const isComplete = profile.completionStatus.missingRequired.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.displayName}>
          {profile.displayName}, {profile.age}
        </Text>
        {profile.city && <Text style={styles.cityText}>📍 {profile.city}</Text>}
        {profile.bio && <Text style={styles.bioText}>{profile.bio}</Text>}
      </View>

      {/* Completeness & Lifecycle Status */}
      <CompletenessCard completeness={profile.completionStatus} visibility={profile.visibility} />

      {/* Photos Grid */}
      <MediaGrid
        media={media}
        onUploadPress={onUploadPhotoPress}
        onSetPrimary={onSetPrimaryPhoto}
        onDeleteMedia={onDeletePhoto}
      />

      {/* Prompts */}
      <PromptsList prompts={prompts} />

      {/* Preferences Summary */}
      {preferences && <PreferencesView preferences={preferences} />}

      {/* Lifecycle Actions */}
      <View style={styles.actionContainer}>
        {profile.visibility === 'DRAFT' && (
          <TouchableOpacity
            style={[styles.primaryButton, !isComplete && styles.disabledButton]}
            disabled={!isComplete}
            onPress={onActivatePress}
          >
            <Text style={styles.primaryButtonText}>
              {isComplete ? 'Activate Profile' : 'Complete Profile to Activate'}
            </Text>
          </TouchableOpacity>
        )}

        {profile.visibility === 'ACTIVE' && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onPausePress}>
              <Text style={styles.secondaryButtonText}>Pause Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onHidePress}>
              <Text style={styles.secondaryButtonText}>Hide Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {(profile.visibility === 'PAUSED' || profile.visibility === 'HIDDEN') && (
          <TouchableOpacity style={styles.primaryButton} onPress={onActivatePress}>
            <Text style={styles.primaryButtonText}>Resume in Discovery</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  cityText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  bioText: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
    lineHeight: 22,
  },
  actionContainer: {
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#E11D48',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
