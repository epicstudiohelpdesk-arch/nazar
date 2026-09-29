import React from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { ProfileCard } from '../../src/design/components/card/ProfileCard.js';
import { useProfileStore } from '../../src/profile/profile-store.js';

export default function ProfilePreviewRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const profile = useProfileStore((state) => state.profile);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Profile Preview"
        onBack={() => router.back()}
        leftAction="close"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          context="profilePreview"
          profile={{
            id: profile?.userId || 'my-profile',
            name: profile?.displayName || 'My Profile',
            age: profile?.age || 27,
            verified: true,
            location: profile?.city || 'Mumbai, India',
            bio: profile?.bio || 'Lover of morning treks, indie cinema, and authentic chai.',
            images: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
            ],
            interests: ['Filter Coffee', 'Indie Cinema', 'Hindustani Classical'],
            prompts: [
              {
                question: 'My ideal Sunday morning looks like...',
                answer: 'Early morning filter coffee at Matunga, followed by scouring second-hand book stalls in Fort.',
              },
            ],
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
  content: {
    padding: 16,
  },
});
