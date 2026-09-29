import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { IconButton } from '../../src/design/components/button/IconButton.js';
import { ProfileCard } from '../../src/design/components/card/ProfileCard.js';

export default function PublicProfileRoute(): React.JSX.Element {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Profile"
        onBack={() => router.back()}
        leftAction="back"
        rightAction={
          <View style={styles.headerActions}>
            <IconButton
              icon="flag"
              size="sm"
              variant="tertiary"
              accessibilityLabel="Report profile"
              onPress={() => router.push(`/modal/report?targetId=${userId}`)}
            />
            <IconButton
              icon="more"
              size="sm"
              variant="tertiary"
              accessibilityLabel="Block profile"
              onPress={() => router.push(`/modal/block?targetUserId=${userId}`)}
            />
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          context="discovery"
          profile={{
            id: userId || 'demo-user',
            name: 'Ananya',
            age: 26,
            verified: true,
            location: 'Bandra West, Mumbai',
            bio: 'Architect by weekday, classical vocalist by weekend. Big fan of street food and brutalist structures.',
            images: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
            ],
            interests: ['Architecture', 'Classical Music', 'Street Food', 'Filter Coffee'],
            prompts: [
              {
                question: 'My ideal Sunday morning looks like...',
                answer: 'Filter coffee at Matunga followed by leisurely book browsing in Fort.',
              },
            ],
          }}
          onLike={() => {
            router.push('/modal/celebration?matchId=m-demo');
          }}
          onPass={() => {
            router.back();
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    padding: 16,
  },
});
