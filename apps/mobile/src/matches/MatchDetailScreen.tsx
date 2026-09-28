import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@platform/ui';
import type { MatchDetailDto } from '@platform/api-contracts';
import { createMatchesApi, MATCHES_QUERY_KEYS } from './matches-api.js';
import type { AuthClient } from '../auth/auth-client.js';

const windowWidth =
  typeof Dimensions !== 'undefined' && typeof Dimensions.get === 'function'
    ? (Dimensions.get('window')?.width ?? 375)
    : 375;

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
  const queryClient = useQueryClient();
  const matchesApi = useMemo(() => createMatchesApi(authClient), [authClient]);
  const [unmatchError, setUnmatchError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<MatchDetailDto, Error>({
    queryKey: MATCHES_QUERY_KEYS.detail(matchId),
    queryFn: () => matchesApi.getMatchDetail(matchId),
  });

  const unmatchMutation = useMutation({
    mutationFn: (reason?: string) => matchesApi.unmatch(matchId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });
      onUnmatched?.();
      onBack();
    },
    onError: (err: Error) => {
      setUnmatchError(err.message || 'Failed to unmatch');
    },
  });

  const handleUnmatch = () => {
    Alert.alert(
      'Unmatch Confirmation',
      'Are you sure you want to unmatch? You will no longer be able to message each other.',
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading match details...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to load match profile</Text>
        <Text style={styles.errorSubtitle}>
          {error?.message || 'Match not found or access denied.'}
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { otherUser, matchedAt, status } = data;
  const primaryPhoto =
    otherUser.media.find((m) => m.isPrimary) || (otherUser.media.length > 0 ? otherUser.media[0] : null);

  const formattedDate = new Date(matchedAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUser.displayName}</Text>
        <TouchableOpacity
          onPress={handleUnmatch}
          disabled={unmatchMutation.isPending || status === 'UNMATCHED'}
          style={styles.unmatchHeaderBtn}
          accessibilityRole="button"
          accessibilityLabel="Unmatch"
        >
          <Text style={styles.unmatchHeaderText}>Unmatch</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {unmatchError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{unmatchError}</Text>
          </View>
        ) : null}

        {/* Primary Media Photo */}
        <View style={styles.photoContainer}>
          {primaryPhoto?.url ? (
            <Image
              source={{ uri: primaryPhoto.url }}
              style={styles.photo}
              resizeMode="cover"
              accessibilityLabel={`${otherUser.displayName}'s primary photo`}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>{otherUser.displayName.charAt(0)}</Text>
            </View>
          )}

          <View style={styles.matchedBadge}>
            <Text style={styles.matchedBadgeText}>Matched on {formattedDate}</Text>
          </View>
        </View>

        {/* User Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.nameAgeRow}>
            <Text style={styles.displayName}>{otherUser.displayName}</Text>
            <Text style={styles.age}>, {otherUser.age}</Text>
          </View>

          {otherUser.city ? (
            <Text style={styles.locationText}>
              📍 {otherUser.city}
              {otherUser.countryCode ? `, ${otherUser.countryCode}` : ''}
            </Text>
          ) : null}

          {otherUser.occupation || otherUser.education ? (
            <Text style={styles.occupationText}>
              💼 {otherUser.occupation || otherUser.education}
            </Text>
          ) : null}

          {/* Bio */}
          {otherUser.bio ? <Text style={styles.bio}>{otherUser.bio}</Text> : null}

          {/* Interests */}
          {otherUser.interests && otherUser.interests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsRow}>
                {otherUser.interests.map((interest) => (
                  <View key={interest.id} style={styles.interestChip}>
                    <Text style={styles.interestText}>{interest.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Prompts */}
          {otherUser.prompts && otherUser.prompts.length > 0 ? (
            <View style={styles.section}>
              {otherUser.prompts.map((prompt) => (
                <View key={prompt.id} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.prompt}</Text>
                  <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Additional Photos */}
          {otherUser.media.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>More Photos</Text>
              <View style={styles.photoGrid}>
                {otherUser.media.slice(1).map((media) => (
                  <Image
                    key={media.id}
                    source={{ uri: media.url }}
                    style={styles.gridPhoto}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Danger zone / Unmatch button */}
          <View style={styles.dangerSection}>
            <TouchableOpacity
              style={styles.unmatchButton}
              onPress={handleUnmatch}
              disabled={unmatchMutation.isPending || status === 'UNMATCHED'}
              accessibilityRole="button"
              accessibilityLabel={`Unmatch ${otherUser.displayName}`}
              testID="unmatch-confirm-btn"
            >
              {unmatchMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.status.error} />
              ) : (
                <Text style={styles.unmatchButtonText}>
                  {status === 'UNMATCHED' ? 'Already Unmatched' : 'Unmatch User'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  unmatchHeaderBtn: {
    padding: spacing.xs,
  },
  unmatchHeaderText: {
    fontSize: typography.fontSize.sm,
    color: colors.status.error,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: spacing.sm,
  },
  errorBannerText: {
    color: colors.status.error,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  photoContainer: {
    width: windowWidth,
    height: 420,
    backgroundColor: colors.neutral[200],
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 64,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[600],
  },
  matchedBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  matchedBadgeText: {
    color: colors.neutral[50],
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  detailsContainer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    marginTop: -spacing.md,
  },
  nameAgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  displayName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[900],
  },
  age: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.neutral[700],
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  occupationText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[800],
    lineHeight: 22,
    marginVertical: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.neutral[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  interestChip: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  interestText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  promptCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  promptAnswer: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[800],
    fontStyle: 'italic',
    lineHeight: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridPhoto: {
    width: (windowWidth - spacing.lg * 2 - spacing.sm) / 2,
    height: 180,
    borderRadius: spacing.md,
  },
  dangerSection: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  unmatchButton: {
    borderWidth: 1,
    borderColor: colors.status.error,
    borderRadius: 999,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 180,
    alignItems: 'center',
  },
  unmatchButtonText: {
    color: colors.status.error,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    color: colors.status.error,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.neutral[50],
    fontWeight: typography.fontWeight.semibold as '600',
    fontSize: typography.fontSize.sm,
  },
  secondaryButton: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: colors.neutral[800],
    fontWeight: typography.fontWeight.semibold as '600',
    fontSize: typography.fontSize.sm,
  },
});
