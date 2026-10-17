import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaItemResponse, PromptDefinitionItem } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { MediaGrid } from '../../src/profile/components/MediaGrid.js';
import { SmartPhotosCard } from '../../src/profile/components/SmartPhotosCard.js';
import { InterestsPicker } from '../../src/profile/components/InterestsPicker.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../../src/profile/profile-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

interface EditablePrompt {
  promptDefinitionId: string;
  prompt: string;
  answer: string;
}

const SAMPLE_PHOTO_REPLACEMENTS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800',
];

export default function EditProfileRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const profileApi = getDefaultProfileApi();

  // Queries
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.me,
    queryFn: () => profileApi.getMyProfile(),
  });

  const mediaQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.media,
    queryFn: () => profileApi.getMediaList(),
  });

  const interestsTaxonomyQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.interestsTaxonomy,
    queryFn: () => profileApi.getInterestsTaxonomy(),
  });

  const myInterestsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myInterests,
    queryFn: () => profileApi.getMyInterests(),
  });

  const promptsTaxonomyQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.promptsTaxonomy,
    queryFn: () => profileApi.getPromptsTaxonomy(),
  });

  const myPromptsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myPrompts,
    queryFn: () => profileApi.getMyPrompts(),
  });

  const smartPhotosStatsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.smartPhotosStats,
    queryFn: () => profileApi.getSmartPhotosStats(),
  });

  // Local Form State
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<EditablePrompt[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Prompt Question Picker Modal State
  const [promptModalVisible, setPromptModalVisible] = useState(false);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);

  // Sync initial values once queries resolve
  useEffect(() => {
    if (!isInitialized && profileQuery.data) {
      setBio(profileQuery.data.bio || '');
      setCity(profileQuery.data.city || '');
      setOccupation(profileQuery.data.occupation || '');
      setEducation(profileQuery.data.education || '');

      if (myInterestsQuery.data) {
        setSelectedInterestIds(myInterestsQuery.data.map((i) => i.id));
      }

      if (myPromptsQuery.data) {
        setPrompts(
          myPromptsQuery.data.map((p) => ({
            promptDefinitionId: p.promptDefinitionId,
            prompt: p.prompt,
            answer: p.answer,
          }))
        );
      }

      setIsInitialized(true);
    }
  }, [profileQuery.data, myInterestsQuery.data, myPromptsQuery.data, isInitialized]);

  // Mutations
  const addPhotoMutation = useMutation({
    mutationFn: async () => {
      const uploadInfo = await profileApi.requestUploadUrl({
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 512,
      });
      return await profileApi.completeUpload(uploadInfo.mediaId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.media });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Photo upload failed';
      Alert.alert('Upload Error', msg);
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

  const setPrimaryMutation = useMutation({
    mutationFn: (mediaId: string) => profileApi.setPrimaryPhoto(mediaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.media });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set primary photo';
      Alert.alert('Photo Error', msg);
    },
  });

  const toggleSmartPhotosMutation = useMutation({
    mutationFn: (enabled: boolean) => profileApi.toggleSmartPhotos(enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.smartPhotosStats });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.me });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to toggle Smart Photos';
      Alert.alert('Smart Photos', msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update basic profile info
      await profileApi.updateMyProfile({
        bio: bio.trim(),
        city: city.trim(),
        occupation: occupation.trim() || undefined,
        education: education.trim() || undefined,
      });

      // 2. Update interests
      await profileApi.updateMyInterests({
        interestIds: selectedInterestIds,
      });

      // 3. Update prompts (filter non-empty answers)
      const validPrompts = prompts
        .filter((p) => p.answer.trim().length > 0)
        .map((p, idx) => ({
          promptDefinitionId: p.promptDefinitionId,
          answer: p.answer.trim(),
          position: idx,
        }));

      await profileApi.updateMyPrompts({
        prompts: validPrompts,
      });
    },
    onSuccess: () => {
      setIsDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['discovery'] });
      trackOnboardingEvent('profile_updated');
      Alert.alert('Saved', 'Your profile updates have been published.', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          },
        },
      ]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      Alert.alert('Save Error', msg);
    },
  });

  const handleBack = () => {
    if (isDirty) {
      Alert.alert(
        'Discard Unsaved Changes?',
        'You have unsaved changes that will be lost if you leave now.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            },
          },
        ]
      );
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/profile');
      }
    }
  };

  const handleToggleInterest = (interestId: string) => {
    setIsDirty(true);
    setSelectedInterestIds((prev) =>
      prev.includes(interestId) ? prev.filter((id) => id !== interestId) : [...prev, interestId]
    );
  };

  const handlePromptAnswerChange = (index: number, answerText: string) => {
    setIsDirty(true);
    setPrompts((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], answer: answerText };
      }
      return next;
    });
  };

  const handleRemovePrompt = (index: number) => {
    setIsDirty(true);
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenPromptPicker = (index: number) => {
    setEditingPromptIndex(index);
    setPromptModalVisible(true);
  };

  const handleAddNewPrompt = () => {
    if (prompts.length >= 3) return;
    const taxonomy = promptsTaxonomyQuery.data || [];
    const usedIds = new Set(prompts.map((p) => p.promptDefinitionId));
    const available = taxonomy.find((t) => !usedIds.has(t.id)) || taxonomy[0];

    if (available) {
      setIsDirty(true);
      setPrompts((prev) => [
        ...prev,
        {
          promptDefinitionId: available.id,
          prompt: available.prompt,
          answer: '',
        },
      ]);
    }
  };

  const handleSelectPromptDefinition = (def: PromptDefinitionItem) => {
    if (editingPromptIndex !== null) {
      setIsDirty(true);
      setPrompts((prev) => {
        const next = [...prev];
        if (next[editingPromptIndex]) {
          next[editingPromptIndex] = {
            ...next[editingPromptIndex],
            promptDefinitionId: def.id,
            prompt: def.prompt,
          };
        }
        return next;
      });
    }
    setPromptModalVisible(false);
    setEditingPromptIndex(null);
  };

  const mediaList: MediaItemResponse[] = useMemo(() => {
    const raw = mediaQuery.data || [];
    return raw.map((item, idx) => ({
      ...item,
      url: item.url.startsWith('http')
        ? item.url
        : SAMPLE_PHOTO_REPLACEMENTS[idx % SAMPLE_PHOTO_REPLACEMENTS.length] || item.url,
    }));
  }, [mediaQuery.data]);

  const isLoadingInitial = profileQuery.isLoading && !profileQuery.data;

  if (isLoadingInitial) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TopNavHeader
          title="Edit Profile"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/profile');
          }}
          leftAction="back"
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading profile editor...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Edit Profile"
        onBack={handleBack}
        leftAction="back"
        rightAction={
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push('/profile/preview')}
            accessibilityLabel="Preview Profile"
          >
            Preview
          </Button>
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: maxContentWidth || 540, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="camera" size="sm" color={theme.colors.accent} />
            </View>
            <Heading level="h3">Photos & Media</Heading>
          </View>
          <Text level="bodySmall" color="secondary">
            Add up to 6 photos. The first photo with the primary badge will be displayed first in
            discovery feeds.
          </Text>
          <MediaGrid
            media={mediaList}
            onUploadPress={() => {
              haptics.light();
              addPhotoMutation.mutate();
            }}
            onSetPrimary={(mediaId) => {
              haptics.selection();
              setPrimaryMutation.mutate(mediaId);
            }}
            onDeleteMedia={(mediaId) => {
              Alert.alert('Remove Photo', 'Are you sure you want to delete this photo?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    haptics.light();
                    deletePhotoMutation.mutate(mediaId);
                  },
                },
              ]);
            }}
          />

          <SmartPhotosCard
            enabled={smartPhotosStatsQuery.data?.enabled ?? profileQuery.data?.smartPhotos ?? true}
            onToggle={(enabled) => {
              haptics.selection();
              toggleSmartPhotosMutation.mutate(enabled);
            }}
            photos={smartPhotosStatsQuery.data?.photos}
            isLoading={smartPhotosStatsQuery.isLoading}
            isToggling={toggleSmartPhotosMutation.isPending}
          />
        </View>

        {/* Basic Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="user" size="sm" color={theme.colors.accent} />
            </View>
            <Heading level="h3">About Me</Heading>
          </View>
          <MultilineInput
            label="Bio"
            value={bio}
            onChangeText={(text) => {
              setBio(text);
              setIsDirty(true);
            }}
            maxLength={300}
            helperText="Share your passions, daily rituals, and what brings you joy (max 300 characters)."
          />
        </View>

        {/* Location & Career Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="location" size="sm" color={theme.colors.accent} />
            </View>
            <Heading level="h3">Location & Background</Heading>
          </View>
          <TextInput
            label="City / Location"
            value={city}
            onChangeText={(text) => {
              setCity(text);
              setIsDirty(true);
            }}
            placeholder="e.g. Mumbai, Maharashtra"
          />
          <TextInput
            label="Occupation / Work"
            value={occupation}
            onChangeText={(text) => {
              setOccupation(text);
              setIsDirty(true);
            }}
            placeholder="e.g. Architect, Software Engineer"
          />
          <TextInput
            label="Education"
            value={education}
            onChangeText={(text) => {
              setEducation(text);
              setIsDirty(true);
            }}
            placeholder="e.g. IIT Bombay, St. Xavier's"
          />
        </View>

        {/* Passions & Interests Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="sparkles" size="sm" color={theme.colors.accent} />
            </View>
            <Heading level="h3">Passions & Interests</Heading>
          </View>
          {interestsTaxonomyQuery.data && (
            <InterestsPicker
              taxonomy={interestsTaxonomyQuery.data}
              selectedIds={selectedInterestIds}
              onToggleInterest={handleToggleInterest}
              maxInterests={10}
            />
          )}
        </View>

        {/* Personality Prompts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconCircle, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon name="heart" size="sm" color={theme.colors.accent} />
            </View>
            <Heading level="h3" style={{ flex: 1 }}>
              Personality Prompts ({prompts.length}/3)
            </Heading>
            {prompts.length < 3 && (
              <Button
                variant="tertiary"
                size="sm"
                onPress={() => {
                  haptics.selection();
                  handleAddNewPrompt();
                }}
                accessibilityLabel="Add Prompt"
              >
                + Add Prompt
              </Button>
            )}
          </View>
          <Text level="bodySmall" color="secondary">
            Prompts give other members a natural conversation starter on your profile.
          </Text>

          {prompts.map((p, index) => (
            <SurfaceCard
              key={`${p.promptDefinitionId}-${index}`}
              elevation="sm"
              style={styles.promptCard}
            >
              <TouchableOpacity
                style={styles.promptQuestionRow}
                onPress={() => {
                  haptics.selection();
                  handleOpenPromptPicker(index);
                }}
                accessibilityRole="button"
                accessibilityLabel="Select different question"
              >
                <Text level="title" color="accent" style={{ flex: 1 }}>
                  {p.prompt}
                </Text>
                <Icon name="chevron" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <MultilineInput
                label="Your Answer"
                value={p.answer}
                onChangeText={(ans) => handlePromptAnswerChange(index, ans)}
                maxLength={200}
                placeholder="Write your answer..."
              />

              <TouchableOpacity
                style={styles.removePromptRow}
                onPress={() => {
                  haptics.light();
                  handleRemovePrompt(index);
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove prompt"
              >
                <Icon name="close" size={14} color={theme.colors.error} />
                <Text level="bodySmall" color="error">
                  Remove prompt
                </Text>
              </TouchableOpacity>
            </SurfaceCard>
          ))}
        </View>

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={saveMutation.isPending}
            disabled={saveMutation.isPending}
            onPress={() => {
              haptics.medium();
              saveMutation.mutate();
            }}
            accessibilityLabel="Save profile changes"
          >
            Save Changes
          </Button>
        </View>
      </ScrollView>

      {/* Prompt Selection Modal */}
      <Modal
        visible={promptModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPromptModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <TopNavHeader
            title="Select a Prompt"
            onBack={() => setPromptModalVisible(false)}
            leftAction="close"
          />
          <FlatList
            data={promptsTaxonomyQuery.data || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.promptListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.promptOption, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleSelectPromptDefinition(item)}
              >
                <Text level="body" weight="medium">
                  {item.prompt}
                </Text>
                <Text level="caption" color="tertiary" style={{ marginTop: 4 }}>
                  {item.category}
                </Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 24,
    paddingBottom: 48,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCard: {
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  promptQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  removePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  buttonWrapper: {
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
  },
  promptListContent: {
    padding: 20,
  },
  promptOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
});
