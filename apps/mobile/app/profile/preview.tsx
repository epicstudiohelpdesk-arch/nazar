import React, { useMemo } from 'react';
import { StyleSheet, SafeAreaView, ScrollView, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { ProfileCard } from '../../src/design/components/card/ProfileCard.js';
import { Text } from '../../src/design/primitives/Text.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../../src/profile/profile-api.js';

const SAMPLE_PHOTO_REPLACEMENTS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800',
];

export default function ProfilePreviewRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const profileApi = getDefaultProfileApi();

  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.me,
    queryFn: () => profileApi.getMyProfile(),
  });

  const mediaQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.media,
    queryFn: () => profileApi.getMediaList(),
  });

  const myInterestsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myInterests,
    queryFn: () => profileApi.getMyInterests(),
  });

  const myPromptsQuery = useQuery({
    queryKey: PROFILE_QUERY_KEYS.myPrompts,
    queryFn: () => profileApi.getMyPrompts(),
  });

  const profile = profileQuery.data;
  const media = mediaQuery.data || [];
  const interests = myInterestsQuery.data || [];
  const prompts = myPromptsQuery.data || [];

  const images = useMemo(() => {
    if (media.length === 0) {
      return [SAMPLE_PHOTO_REPLACEMENTS[0]!];
    }
    return media.map((m, idx) =>
      m.url.startsWith('http')
        ? m.url
        : SAMPLE_PHOTO_REPLACEMENTS[idx % SAMPLE_PHOTO_REPLACEMENTS.length] || m.url
    );
  }, [media]);

  const isLoading = profileQuery.isLoading && !profile;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TopNavHeader title="Profile Preview" onBack={() => router.back()} leftAction="close" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading preview...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader title="Profile Preview" onBack={() => router.back()} leftAction="close" />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          context="profilePreview"
          profile={{
            id: profile?.id || 'my-profile',
            name: profile?.displayName || 'My Profile',
            age: profile?.age || 26,
            verified: true,
            location: profile?.city || 'Mumbai, India',
            occupation: profile?.occupation || undefined,
            education: profile?.education || undefined,
            bio: profile?.bio || 'Looking forward to genuine conversations and shared adventures.',
            images,
            interests: interests.map((i) => i.name),
            prompts: prompts.map((p) => ({
              question: p.prompt,
              answer: p.answer,
            })),
          }}
        />
      </ScrollView>
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
    padding: 16,
    paddingBottom: 40,
  },
});
