import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { MatchDetailDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/ThemeContext.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { Heading } from '../design/primitives/Heading.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Badge } from '../design/primitives/Badge.js';
import { Button } from '../design/components/button/Button.js';
import { IconButton } from '../design/components/button/IconButton.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { createMatchesApi, MATCHES_QUERY_KEYS } from './matches-api.js';
import { createChatApi } from '../chat/chat-api.js';
import type { AuthClient } from '../auth/auth-client.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface MatchDetailScreenProps {
  readonly authClient: AuthClient;
  readonly matchId: string;
  readonly onBack: () => void;
  readonly onUnmatched?: () => void;
}

export const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({
  authClient,
  matchId,
  onBack,
  onUnmatched,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const matchesApi = useMemo(() => createMatchesApi(authClient), [authClient]);
  const chatApi = useMemo(() => createChatApi(authClient), [authClient]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isNavigatingChat, setIsNavigatingChat] = useState(false);

  const { isSmallScreen, isLargeScreen, width: windowWidth } = useResponsiveLayout();
  const photoWidth = Math.min(windowWidth - 32, 500);
  const photoHeight = isSmallScreen ? 340 : isLargeScreen ? 460 : 400;

  const handleNextPhoto = () => {
    const photos = (data?.otherUser?.media || []).map((m) => m.url);
    if (photos.length > 1) {
      haptics.selection();
      setActivePhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const handlePrevPhoto = () => {
    const photos = (data?.otherUser?.media || []).map((m) => m.url);
    if (photos.length > 1) {
      haptics.selection();
      setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  // Fetch Match Details
  const { data, isLoading, isError, error, refetch } = useQuery<MatchDetailDto, Error>({
    queryKey: MATCHES_QUERY_KEYS.detail(matchId),
    queryFn: async () => {
      if (!matchId) throw new Error('Missing match ID');
      return matchesApi.getMatchDetail(matchId);
    },
    enabled: Boolean(matchId),
  });

  // Track profile opened
  useEffect(() => {
    if (matchId) {
      trackOnboardingEvent('match_profile_opened', { matchId });
    }
  }, [matchId]);

  // Unmatch Mutation
  const unmatchMutation = useMutation({
    mutationFn: async (reason?: string) => {
      trackOnboardingEvent('unmatch_started', { matchId });
      return matchesApi.unmatch(matchId, { reason });
    },
    onSuccess: () => {
      trackOnboardingEvent('unmatch_completed', { matchId });
      queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });

      Alert.alert(
        'Connection Ended',
        'You have unmatched this user. Your chat and mutual match have been removed.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onUnmatched) {
                onUnmatched();
              } else {
                onBack();
              }
            },
          },
        ]
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to unmatch connection';
      Alert.alert('Action Failed', msg);
    },
  });

  const handleConfirmUnmatch = () => {
    Alert.alert(
      'Unmatch this connection?',
      'You will no longer be able to view their profile, message each other, or see each other in match lists.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: () => unmatchMutation.mutate('USER_INITIATED'),
        },
      ]
    );
  };

  const handleStartMessage = async () => {
    if (!data) return;
    setIsNavigatingChat(true);
    trackOnboardingEvent('match_message_clicked', {
      matchId,
      targetUserId: data.otherUser.userId,
    });

    try {
      // Look up conversation associated with this match
      const convList = await chatApi.getConversations({ limit: 50 });
      const existingConv = convList.items.find((c) => c.matchId === matchId);
      const targetRoute = existingConv ? existingConv.id : matchId;
      router.push(`/chat/${targetRoute}`);
    } catch {
      // Fallback navigation with matchId
      router.push(`/chat/${matchId}`);
    } finally {
      setIsNavigatingChat(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TopNavHeader title="Connection" leftAction="back" onBack={onBack} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
            Loading connection details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TopNavHeader title="Connection" leftAction="back" onBack={onBack} />
        <View style={styles.centerContainer}>
          <Icon name="warning" size="lg" color={theme.colors.warning} />
          <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
            Connection Unavailable
          </Heading>
          <Text level="body" color="secondary" style={styles.messageText}>
            {error?.message || 'This connection is no longer active or has been dissolved.'}
          </Text>
          <Button
            variant="secondary"
            size="md"
            onPress={() => refetch()}
            style={{ marginTop: 16 }}
            accessibilityLabel="Retry loading connection"
          >
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { otherUser, matchedAt, status, expiresAt } = data;
  const photos = (otherUser.media || []).map((m) => m.url);
  const formattedDate = new Date(matchedAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      if (Number.isNaN(expiry) || expiry <= now) {
        setTimeRemaining('Expired');
        return;
      }
      const diffMs = expiry - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <TopNavHeader
        title={otherUser.displayName}
        leftAction="back"
        onBack={onBack}
        rightAction={
          <View style={styles.headerActions}>
            <IconButton
              icon="flag"
              size="sm"
              variant="tertiary"
              accessibilityLabel="Report member"
              onPress={() => router.push(`/modal/report?targetId=${otherUser.userId}`)}
              testID="matches.match.report"
            />
            <IconButton
              icon="more"
              size="sm"
              variant="tertiary"
              accessibilityLabel="Block member"
              onPress={() => router.push(`/modal/block?targetUserId=${otherUser.userId}`)}
              testID="matches.match.block"
            />
          </View>
        }
      />

      <View style={styles.bodyWrapper}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { maxWidth: 540, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Carousel with Story Progress Bars & Tap Zones */}
          {photos.length > 0 ? (
            <View style={[styles.galleryContainer, { width: photoWidth, height: photoHeight }]}>
              <Image
                source={{ uri: photos[activePhotoIndex] }}
                style={[styles.photoImage, { width: photoWidth, height: photoHeight }]}
                resizeMode="cover"
                accessibilityLabel={`${otherUser.displayName}'s photo ${activePhotoIndex + 1}`}
              />

              {/* Photo Vignette */}
              <View style={styles.photoVignette} pointerEvents="none" />

              {/* Story-Style Progress Bars */}
              {photos.length > 1 && (
                <View style={styles.storyBarsContainer}>
                  {photos.map((_, idx) => (
                    <View
                      key={`story-${idx}`}
                      style={[
                        styles.storyBarTrack,
                        {
                          backgroundColor:
                            idx === activePhotoIndex ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Tap Zones for Left/Right Story Navigation */}
              {photos.length > 1 && (
                <View style={styles.tapZonesRow} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.tapZone}
                    onPress={handlePrevPhoto}
                    activeOpacity={1}
                    accessibilityLabel="Previous photo"
                  />
                  <TouchableOpacity
                    style={styles.tapZone}
                    onPress={handleNextPhoto}
                    activeOpacity={1}
                    accessibilityLabel="Next photo"
                  />
                </View>
              )}

              {/* Matched Date Ribbon */}
              <View
                style={[
                  styles.matchedRibbon,
                  { backgroundColor: 'rgba(0, 0, 0, 0.72)', borderColor: theme.colors.accent },
                ]}
              >
                <Icon
                  name="heart"
                  size="tiny"
                  color={theme.colors.accent}
                  fill={theme.colors.accent}
                />
                <Text level="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Matched on {formattedDate}
                </Text>
              </View>

              {/* Expiry Countdown Ribbon */}
              {expiresAt && timeRemaining && (
                <View
                  style={[
                    styles.expiryRibbon,
                    {
                      backgroundColor: 'rgba(0, 0, 0, 0.72)',
                      borderColor:
                        timeRemaining === 'Expired' ? theme.colors.error : theme.colors.warning,
                    },
                  ]}
                >
                  <Icon
                    name="alertCircle"
                    size="tiny"
                    color={timeRemaining === 'Expired' ? theme.colors.error : theme.colors.warning}
                  />
                  <Text level="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                    {timeRemaining === 'Expired' ? 'Match expired' : timeRemaining}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Profile Identity Details */}
          <View style={styles.identitySection}>
            <View style={styles.nameRow}>
              <Heading level="h1" style={styles.nameText}>
                {otherUser.displayName}, {otherUser.age}
              </Heading>
              <Badge variant="success" icon="checkCircle" label="Verified" size="sm" />
            </View>

            {/* Coarse Location */}
            {(otherUser.city || otherUser.countryCode) && (
              <View style={styles.locationRow}>
                <Icon name="location" size="sm" color={theme.colors.textSecondary} />
                <Text level="body" color="secondary">
                  {[otherUser.city, otherUser.countryCode].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {/* Occupation & Education Micro-Badges */}
            {(otherUser.occupation || otherUser.education) && (
              <View style={styles.detailsRow}>
                {otherUser.occupation && (
                  <View
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Icon name="briefcase" size="sm" color={theme.colors.textSecondary} />
                    <Text level="bodySmall" color="secondary">
                      {otherUser.occupation}
                    </Text>
                  </View>
                )}
                {otherUser.education && (
                  <View
                    style={[
                      styles.detailChip,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Icon name="graduationCap" size="sm" color={theme.colors.textSecondary} />
                    <Text level="bodySmall" color="secondary">
                      {otherUser.education}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Suggested Icebreakers */}
          {data.suggestedIcebreakers && data.suggestedIcebreakers.length > 0 && (
            <View style={styles.section}>
              <Heading level="h3" style={styles.sectionTitle}>
                Suggested Icebreakers
              </Heading>
              {data.suggestedIcebreakers.map((ib, idx) => (
                <SurfaceCard key={`ib-${idx}`} elevation="sm" style={styles.icebreakerCard}>
                  <View style={styles.icebreakerRow}>
                    <Icon name="sparkles" size="sm" color={theme.colors.accent} />
                    <Text level="body" style={styles.icebreakerText}>
                      {ib}
                    </Text>
                  </View>
                </SurfaceCard>
              ))}
            </View>
          )}

          {/* Bio Surface Card */}
          {otherUser.bio ? (
            <SurfaceCard elevation="sm" style={styles.bioCard}>
              <Heading level="h3" style={{ marginBottom: 6 }}>
                About Me
              </Heading>
              <Text level="body" style={styles.bioText}>
                {otherUser.bio}
              </Text>
            </SurfaceCard>
          ) : null}

          {/* Prompts Section */}
          {otherUser.prompts && otherUser.prompts.length > 0 ? (
            <View style={styles.section}>
              {otherUser.prompts.map((p, idx) => (
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
          {otherUser.interests && otherUser.interests.length > 0 ? (
            <View style={styles.section}>
              <Heading level="h3" style={styles.sectionTitle}>
                Interests & Passions
              </Heading>
              <View style={styles.interestsContainer}>
                {otherUser.interests.map((interest) => (
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
                    <Text
                      level="caption"
                      style={{ color: theme.colors.textPrimary, fontWeight: '600' }}
                    >
                      {interest.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Unmatch Link */}
          <View style={styles.dangerZone}>
            <TouchableOpacity
              onPress={handleConfirmUnmatch}
              disabled={unmatchMutation.isPending || status === 'UNMATCHED'}
              accessibilityRole="button"
              accessibilityLabel={`Unmatch ${otherUser.displayName}`}
              testID="matches.match.unmatch"
            >
              <Text level="bodySmall" style={{ color: theme.colors.error, fontWeight: '600' }}>
                {status === 'UNMATCHED' ? 'Connection Dissolved' : 'Unmatch this member'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Floating Message Bar */}
        <View
          style={[
            styles.bottomActionBar,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={{ maxWidth: 540, width: '100%', alignSelf: 'center' }}>
            <Button
              variant="primary"
              size="lg"
              icon="message"
              fullWidth
              isLoading={isNavigatingChat}
              onPress={() => {
                haptics.selection();
                void handleStartMessage();
              }}
              accessibilityLabel={`Send message to ${otherUser.displayName}`}
              testID="matches.match.message"
            >
              Send Message
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

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
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
    backgroundColor: '#000000',
  },
  photoImage: {
    borderRadius: 24,
  },
  photoVignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  storyBarsContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  storyBarTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  tapZonesRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapZone: {
    flex: 1,
    height: '100%',
  },
  matchedRibbon: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 12,
  },
  expiryRibbon: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 12,
  },
  identitySection: {
    gap: 8,
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
    gap: 8,
    marginTop: 4,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
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
  icebreakerCard: {
    padding: 14,
    borderRadius: 16,
    gap: 6,
  },
  icebreakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icebreakerText: {
    flex: 1,
    lineHeight: 22,
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
  dangerZone: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
});
