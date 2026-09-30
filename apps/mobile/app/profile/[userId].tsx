import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicProfileResponse } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { IconButton } from '../../src/design/components/button/IconButton.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { Badge } from '../../src/design/primitives/Badge.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';
import { Button } from '../../src/design/components/button/Button.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { getDefaultInteractionsApi } from '../../src/interactions/interactions-api.js';
import { MATCHES_QUERY_KEYS } from '../../src/matches/matches-api.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_WIDTH = SCREEN_WIDTH - 32;
const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 1.25);

export default function PublicProfileRoute(): React.JSX.Element {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const profileApi = getDefaultProfileApi();
  const interactionsApi = getDefaultInteractionsApi();

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Public Profile from server
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PublicProfileResponse, Error>({
    queryKey: ['profile', 'public', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Missing profile ID');
      return profileApi.getPublicProfile(userId);
    },
    enabled: Boolean(userId),
  });

  // Track profile opened
  React.useEffect(() => {
    if (userId) {
      trackOnboardingEvent('profile_opened', { targetUserId: userId });
    }
  }, [userId]);

  // LIKE Mutation
  const likeMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return interactionsApi.like(targetUserId);
    },
    onSuccess: (res, targetUserId) => {
      trackOnboardingEvent('like_sent', { targetUserId, matched: res.matched });
      if (res.matched && res.matchId) {
        trackOnboardingEvent('match_created', { matchId: res.matchId });
        queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });

        const candidateName = profile?.displayName || 'Your Match';
        router.replace(
          `/modal/celebration?matchId=${res.matchId}&targetUserId=${targetUserId}&userName=${encodeURIComponent(candidateName)}`
        );
      } else {
        router.back();
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to send like';
      Alert.alert('Action Error', msg);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // PASS Mutation
  const passMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return interactionsApi.pass(targetUserId);
    },
    onSuccess: (_, targetUserId) => {
      trackOnboardingEvent('pass_sent', { targetUserId });
      router.back();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to pass profile';
      Alert.alert('Action Error', msg);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleLike = () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    likeMutation.mutate(userId);
  };

  const handlePass = () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    passMutation.mutate(userId);
  };

  const mediaList = profile?.media || [];
  const photos = mediaList.map((m) => m.url);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title={profile ? profile.displayName : 'Profile'}
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

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading member profile...
          </Text>
        </View>
      ) : isError || !profile ? (
        <View style={styles.centerContainer}>
          <Icon name="warning" size="lg" color={theme.colors.warning} />
          <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
            Profile Not Found
          </Heading>
          <Text level="body" color="secondary" style={styles.messageText}>
            {error?.message || 'This profile is no longer available or has been paused.'}
          </Text>
          <Button
            variant="secondary"
            size="md"
            onPress={() => refetch()}
            style={{ marginTop: 16 }}
            accessibilityLabel="Retry loading profile"
          >
            Retry
          </Button>
        </View>
      ) : (
        <View style={styles.bodyWrapper}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Multi-Photo Carousel */}
            {photos.length > 0 ? (
              <View style={styles.galleryContainer}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const offset = e.nativeEvent.contentOffset.x;
                    const index = Math.round(offset / PHOTO_WIDTH);
                    if (index !== activePhotoIndex) {
                      setActivePhotoIndex(index);
                    }
                  }}
                  scrollEventThrottle={16}
                  style={styles.photoScroll}
                >
                  {photos.map((photoUrl, idx) => (
                    <View key={`${photoUrl}-${idx}`} style={styles.photoSlide}>
                      <Image
                        source={{ uri: photoUrl }}
                        style={styles.photoImage}
                        resizeMode="cover"
                        accessibilityLabel={`${profile.displayName}'s photo ${idx + 1}`}
                      />
                    </View>
                  ))}
                </ScrollView>

                {/* Pagination Dots */}
                {photos.length > 1 && (
                  <View style={styles.dotsRow}>
                    {photos.map((_, idx) => (
                      <View
                        key={`dot-${idx}`}
                        style={[
                          styles.dot,
                          idx === activePhotoIndex
                            ? [styles.activeDot, { backgroundColor: theme.colors.accent }]
                            : { backgroundColor: 'rgba(255, 255, 255, 0.5)' },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {/* Profile Identity Info */}
            <View style={styles.identitySection}>
              <View style={styles.nameRow}>
                <Heading level="h1" style={styles.nameText}>
                  {profile.displayName}, {profile.age}
                </Heading>
                <Badge variant="success" icon="checkCircle" label="Verified" size="sm" />
              </View>

              {/* Coarse Location */}
              {(profile.city || profile.countryCode) && (
                <View style={styles.locationRow}>
                  <Icon name="location" size="sm" color={theme.colors.textSecondary} />
                  <Text level="body" color="secondary">
                    {[profile.city, profile.countryCode].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}

              {/* Occupation & Education */}
              {(profile.occupation || profile.education) && (
                <View style={styles.detailsRow}>
                  {profile.occupation && (
                    <View style={styles.detailItem}>
                      <Icon name="user" size="sm" color={theme.colors.textSecondary} />
                      <Text level="bodySmall" color="secondary">
                        {profile.occupation}
                      </Text>
                    </View>
                  )}
                  {profile.education && (
                    <View style={styles.detailItem}>
                      <Icon name="sparkles" size="sm" color={theme.colors.textSecondary} />
                      <Text level="bodySmall" color="secondary">
                        {profile.education}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Bio Card */}
            {profile.bio ? (
              <SurfaceCard elevation="sm" style={styles.bioCard}>
                <Heading level="h3" style={{ marginBottom: 6 }}>
                  About Me
                </Heading>
                <Text level="body" style={styles.bioText}>
                  {profile.bio}
                </Text>
              </SurfaceCard>
            ) : null}

            {/* Prompts Section */}
            {profile.prompts && profile.prompts.length > 0 ? (
              <View style={styles.section}>
                {profile.prompts.map((p, idx) => (
                  <SurfaceCard key={`prm-${idx}`} elevation="sm" style={styles.promptCard}>
                    <Text level="caption" color="accent" style={styles.promptQuestion}>
                      {p.prompt}
                    </Text>
                    <Heading level="h3" style={styles.promptAnswer}>
                      {p.answer}
                    </Heading>
                  </SurfaceCard>
                ))}
              </View>
            ) : null}

            {/* Interests Section */}
            {profile.interests && profile.interests.length > 0 ? (
              <View style={styles.section}>
                <Heading level="h3" style={styles.sectionTitle}>
                  Interests & Passions
                </Heading>
                <View style={styles.interestsContainer}>
                  {profile.interests.map((interest) => (
                    <View
                      key={interest.id}
                      style={[
                        styles.interestChip,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text level="caption" style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                        {interest.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom Fixed Interaction Action Bar */}
          <View
            style={[
              styles.bottomActionBar,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
              },
            ]}
          >
            {/* Pass Action */}
            <TouchableOpacity
              style={[
                styles.actionCircle,
                styles.passCircle,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handlePass}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Pass on ${profile.displayName}`}
              testID="profile-detail-pass-btn"
            >
              <Icon name="close" size="md" color={theme.colors.error} />
            </TouchableOpacity>

            {/* Like Action */}
            <TouchableOpacity
              style={[
                styles.actionCircle,
                styles.likeCircle,
                {
                  backgroundColor: theme.colors.accent,
                  borderColor: theme.colors.accent,
                },
              ]}
              onPress={handleLike}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.displayName}`}
              testID="profile-detail-like-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="heart" size="md" color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  messageText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  bodyWrapper: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },
  galleryContainer: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  photoScroll: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  },
  photoSlide: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  identitySection: {
    gap: 6,
    paddingHorizontal: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameText: {
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bioCard: {
    padding: 16,
    borderRadius: 16,
  },
  bioText: {
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    paddingHorizontal: 4,
  },
  promptCard: {
    padding: 18,
    borderRadius: 16,
    gap: 6,
  },
  promptQuestion: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    fontWeight: '500',
    lineHeight: 24,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 28,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  actionCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  likeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
});
