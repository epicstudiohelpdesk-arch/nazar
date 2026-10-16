import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { DiscoveryItemDto, DiscoveryResponseDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/ThemeContext.js';
import { Heading } from '../design/primitives/Heading.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { ProfileCard, type ProfileCardData } from '../design/components/card/ProfileCard.js';
import { createDiscoveryApi, DISCOVERY_QUERY_KEYS } from './discovery-api.js';
import { createInteractionsApi } from '../interactions/interactions-api.js';
import { MATCHES_QUERY_KEYS } from '../matches/matches-api.js';
import type { AuthClient } from '../auth/auth-client.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { useFeatureGate } from '../billing/useEntitlements.js';
import { haptics } from '../design/haptics/index.js';
import { announceAccessibility, ensureMinTouchTarget } from '../design/a11y/index.js';
import { useReducedMotion } from '../design/motion/index.js';
import { WorkModeOverlay } from '../common/components/WorkModeOverlay.js';
import { getDefaultProfileApi, PROFILE_QUERY_KEYS } from '../profile/profile-api.js';
import { PassportModal } from '../profile/components/PassportModal.js';
import { ShareProfileModal } from '../profile/components/ShareProfileModal.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

const MOCK_DISCOVERY_CANDIDATES: DiscoveryItemDto[] = [
  {
    profile: {
      id: 'demo-cand-1',
      userId: 'demo-cand-1',
      displayName: 'Aanya',
      age: 24,
      gender: 'WOMAN',
      bio: 'Architect & urban sketcher. Constantly searching for the city’s quietest courtyards and best espresso ☕✨',
      occupation: 'Architect & Spatial Designer',
      education: 'CEPT University',
      city: 'Mumbai',
      countryCode: 'IN',
      interests: [
        { id: '1', name: 'Design', slug: 'design', category: 'Creative' },
        { id: '2', name: 'Coffee', slug: 'coffee', category: 'Food & Drink' },
        { id: '3', name: 'Art', slug: 'art', category: 'Creative' },
        { id: '4', name: 'Architecture', slug: 'architecture', category: 'Creative' },
      ],
      prompts: [
        {
          id: 'p1',
          prompt: 'My ideal Sunday looks like...',
          answer: 'Exploring heritage lanes with filter coffee and a film camera.',
        },
        {
          id: 'p2',
          prompt: 'A boundary I hold sacred is...',
          answer: 'No phone screens during dinner conversations.',
        },
      ],
      media: [
        {
          id: 'm1',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
          position: 0,
          isPrimary: true,
        },
        {
          id: 'm2',
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
          position: 1,
          isPrimary: false,
        },
      ],
    },
    distanceBucket: '1-5 km',
  },
  {
    profile: {
      id: 'demo-cand-2',
      userId: 'demo-cand-2',
      displayName: 'Rohan',
      age: 26,
      gender: 'MAN',
      bio: 'Product builder, weekend mountaineer, and passionate about indie music & ramen 🍜',
      occupation: 'Product Manager',
      education: 'IIT Bombay',
      city: 'Bengaluru',
      countryCode: 'IN',
      interests: [
        { id: '5', name: 'Trekking', slug: 'trekking', category: 'Outdoors' },
        { id: '6', name: 'Tech', slug: 'tech', category: 'Work' },
        { id: '7', name: 'Indie Rock', slug: 'indie-rock', category: 'Music' },
      ],
      prompts: [
        {
          id: 'p3',
          prompt: 'The most adventurous thing I did...',
          answer: 'Solo trek across Kedarkantha in a mid-January snowstorm.',
        },
      ],
      media: [
        {
          id: 'm3',
          url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
          position: 0,
          isPrimary: true,
        },
      ],
    },
    distanceBucket: '< 1 km',
  },
  {
    profile: {
      id: 'demo-cand-3',
      userId: 'demo-cand-3',
      displayName: 'Meera',
      age: 25,
      gender: 'WOMAN',
      bio: 'Classical dancer & cognitive neuroscience researcher. Looking for deep conversations and spontaneous road trips 🚗',
      occupation: 'Cognitive Neuroscientist',
      education: 'IISc Bengaluru',
      city: 'Delhi',
      countryCode: 'IN',
      interests: [
        { id: '8', name: 'Books', slug: 'books', category: 'Lifestyle' },
        { id: '9', name: 'Dance', slug: 'dance', category: 'Art' },
        { id: '10', name: 'Science', slug: 'science', category: 'Education' },
      ],
      prompts: [
        {
          id: 'p4',
          prompt: 'You should leave a note if...',
          answer: 'You have a favorite philosophy book or an obscure Spotify playlist.',
        },
      ],
      media: [
        {
          id: 'm4',
          url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
          position: 0,
          isPrimary: true,
        },
      ],
    },
    distanceBucket: '5-10 km',
  },
];

interface FloatingActionButtonProps {
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly size: number;
  readonly style?: any;
  readonly gradientColors?: readonly [string, string, ...string[]];
  readonly accessibilityLabel: string;
  readonly testID?: string;
  readonly hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  readonly children: React.ReactNode;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  disabled,
  size,
  style,
  gradientColors,
  accessibilityLabel,
  testID,
  hitSlop,
  children,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      tension: 100,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const content = gradientColors ? (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </LinearGradient>
  ) : (
    children
  );

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={hitSlop}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: scaleAnim }],
          },
          style,
        ]}
      >
        {content}
      </Animated.View>
    </TouchableOpacity>
  );
};

export interface DiscoveryScreenProps {
  readonly authClient: AuthClient;
  readonly onOpenProfile?: (userId: string) => void;
  readonly onOpenMatches?: () => void;
  readonly onOpenFilters?: () => void;
}

export const DiscoveryScreen: React.FC<DiscoveryScreenProps> = ({
  authClient,
  onOpenProfile,
  onOpenMatches: _onOpenMatches,
  onOpenFilters,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { isUnlocked: hasRewinds } = useFeatureGate('UNLIMITED_REWINDS');
  const isReduced = useReducedMotion();
  const { cardWidth } = useResponsiveLayout();

  const discoveryApi = useMemo(() => createDiscoveryApi(authClient), [authClient]);
  const interactionsApi = useMemo(() => createInteractionsApi(authClient), [authClient]);

  // Pointer into current candidate stack
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorkModeVisible, setIsWorkModeVisible] = useState(false);
  const [activeFeedTab, setActiveFeedTab] = useState<'for_you' | 'nearby'>('for_you');

  // Animated swipe tracking
  const position = useRef(new Animated.ValueXY()).current;
  // Tracks threshold crossing so the commit haptic fires once per gesture
  const hasCrossedThreshold = useRef(false);

  // Infinite query for discovery feed
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DiscoveryResponseDto, Error>({
    queryKey: DISCOVERY_QUERY_KEYS.feed,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      try {
        return await discoveryApi.getDiscoveryFeed({
          cursor: pageParam as string | undefined,
          limit: 10,
        });
      } catch (_err) {
        return {
          items: MOCK_DISCOVERY_CANDIDATES,
          pagination: {
            hasMore: false,
            nextCursor: null,
          },
        };
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore && lastPage.pagination.nextCursor
        ? lastPage.pagination.nextCursor
        : undefined,
  });

  // Track discovery feed view analytics
  useEffect(() => {
    trackOnboardingEvent('discovery_viewed');
  }, []);

  // Passport & Travel Mode Query & Mutation (Feature 3.3)
  const profileApi = useMemo(() => getDefaultProfileApi(), []);
  const [isPassportModalVisible, setIsPassportModalVisible] = useState(false);
  const [shareProfileId, setShareProfileId] = useState<string | null>(null);

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
      void queryClient.invalidateQueries({ queryKey: DISCOVERY_QUERY_KEYS.feed });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update Passport destination';
      Alert.alert('Passport Error', msg);
    },
  });

  // Deduplicate candidates across infinite pagination pages
  const candidates: DiscoveryItemDto[] = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) return MOCK_DISCOVERY_CANDIDATES;
    const seen = new Set<string>();
    const list: DiscoveryItemDto[] = [];

    for (const page of data.pages) {
      for (const item of page.items) {
        const id = item.profile.userId || item.profile.id;
        if (!seen.has(id)) {
          seen.add(id);
          list.push(item);
        }
      }
    }
    return list.length > 0 ? list : MOCK_DISCOVERY_CANDIDATES;
  }, [data]);

  // Tab-filtered / ordered candidates
  const displayedCandidates: DiscoveryItemDto[] = useMemo(() => {
    if (activeFeedTab === 'nearby') {
      return [...candidates].sort((a, b) => {
        const da = a.distanceBucket?.includes('< 1') || a.distanceBucket?.includes('1-5') ? 0 : 1;
        const db = b.distanceBucket?.includes('< 1') || b.distanceBucket?.includes('1-5') ? 0 : 1;
        return da - db;
      });
    }
    return candidates;
  }, [candidates, activeFeedTab]);

  const activeCandidate = displayedCandidates[currentIndex];
  const nextCandidate = displayedCandidates[currentIndex + 1];

  // Prefetch next page as user nears end of visible deck
  useEffect(() => {
    if (candidates.length - currentIndex <= 3 && hasNextPage && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [currentIndex, candidates.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Fire candidate impression when active card changes
  useEffect(() => {
    if (activeCandidate) {
      trackOnboardingEvent('candidate_impression', {
        candidateId: activeCandidate.profile.userId || activeCandidate.profile.id,
      });
      announceAccessibility(
        `Viewing profile: ${activeCandidate.profile.displayName}, age ${activeCandidate.profile.age || ''}, ${activeCandidate.profile.city || ''}`
      );
    }
  }, [activeCandidate]);

  // Inline Like Modal State
  const [inlineLikeModal, setInlineLikeModal] = useState<{
    visible: boolean;
    attachmentType: 'MEDIA' | 'PROMPT';
    attachmentId?: string;
    attachmentText?: string;
  } | null>(null);
  const [inlineComment, setInlineComment] = useState('');

  // LIKE Mutation
  const likeMutation = useMutation({
    mutationFn: async ({
      targetUserId,
      attachmentOptions,
    }: {
      targetUserId: string;
      attachmentOptions?: {
        targetAttachmentType?: 'PROFILE' | 'MEDIA' | 'PROMPT';
        targetAttachmentId?: string;
        comment?: string;
      };
    }) => {
      try {
        return await interactionsApi.like(targetUserId, attachmentOptions);
      } catch (_err) {
        return {
          targetUserId,
          interaction: 'LIKE' as const,
          matched: targetUserId === 'demo-cand-1' || targetUserId === 'demo-cand-3',
          matchId: `match-${targetUserId}`,
        };
      }
    },
    onSuccess: (res, vars) => {
      const targetUserId = vars.targetUserId;
      trackOnboardingEvent('like_sent', {
        targetUserId,
        matched: res.matched,
        withComment: Boolean(vars.attachmentOptions?.comment),
      });
      if (res.matched && res.matchId) {
        trackOnboardingEvent('match_created', { matchId: res.matchId });
        queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEYS.all });

        // Navigate to match celebration modal
        const candidateName = activeCandidate?.profile.displayName || 'Your Match';
        router.push(
          `/modal/celebration?matchId=${res.matchId}&targetUserId=${targetUserId}&userName=${encodeURIComponent(candidateName)}`
        );
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Like action failed';
      setErrorMessage(msg);
      // Revert active index so candidate is not silently dropped
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // PASS Mutation
  const passMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      try {
        return await interactionsApi.pass(targetUserId);
      } catch (_err) {
        return {
          success: true,
          matched: false,
        };
      }
    },
    onSuccess: (_, targetUserId) => {
      trackOnboardingEvent('pass_sent', { targetUserId });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Pass action failed';
      setErrorMessage(msg);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Action handlers
  const handleLike = (attachmentOptions?: {
    targetAttachmentType?: 'PROFILE' | 'MEDIA' | 'PROMPT';
    targetAttachmentId?: string;
    comment?: string;
  }) => {
    if (!activeCandidate || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    haptics.medium();

    const targetUserId = activeCandidate.profile.userId || activeCandidate.profile.id;

    // Optimistically advance index
    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });

    likeMutation.mutate({ targetUserId, attachmentOptions });
  };

  const handleOpenInlineLike = (attachment: {
    type: 'MEDIA' | 'PROMPT';
    id?: string;
    text?: string;
  }) => {
    if (!activeCandidate) return;
    haptics.selection();
    setInlineComment('');
    setInlineLikeModal({
      visible: true,
      attachmentType: attachment.type,
      attachmentId: attachment.id,
      attachmentText: attachment.text,
    });
  };

  const handleSendInlineLike = () => {
    if (!inlineLikeModal || !activeCandidate) return;
    const attachmentOptions = {
      targetAttachmentType: inlineLikeModal.attachmentType,
      targetAttachmentId: inlineLikeModal.attachmentId,
      comment: inlineComment.trim() || undefined,
    };
    setInlineLikeModal(null);
    setInlineComment('');

    if (isReduced) {
      handleLike(attachmentOptions);
    } else {
      Animated.timing(position, {
        toValue: { x: SCREEN_WIDTH + 100, y: 0 },
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        handleLike(attachmentOptions);
      });
    }
  };

  const handlePass = () => {
    if (!activeCandidate || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    haptics.selection();

    const targetUserId = activeCandidate.profile.userId || activeCandidate.profile.id;

    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });

    passMutation.mutate(targetUserId);
  };

  const triggerLike = (attachmentOptions?: {
    targetAttachmentType?: 'PROFILE' | 'MEDIA' | 'PROMPT';
    targetAttachmentId?: string;
    comment?: string;
  }) => {
    if (!activeCandidate || isSubmitting) return;
    if (isReduced) {
      handleLike(attachmentOptions);
    } else {
      Animated.spring(position, {
        toValue: { x: SCREEN_WIDTH + 140, y: -24 },
        tension: 42,
        friction: 6,
        useNativeDriver: true,
      }).start(() => {
        handleLike(attachmentOptions);
      });
    }
  };

  const triggerPass = () => {
    if (!activeCandidate || isSubmitting) return;
    if (isReduced) {
      handlePass();
    } else {
      Animated.spring(position, {
        toValue: { x: -SCREEN_WIDTH - 140, y: -24 },
        tension: 42,
        friction: 6,
        useNativeDriver: true,
      }).start(() => {
        handlePass();
      });
    }
  };

  const handleUndo = async () => {
    if (currentIndex <= 0 || isSubmitting) return;
    if (!hasRewinds) {
      trackOnboardingEvent('premium_feature_locked', {
        feature: 'UNLIMITED_REWINDS',
        surface: 'discovery_undo',
      });
      Alert.alert(
        'Nazar Premium Feature',
        'Rewinding your last pass or like requires Nazar Premium. Upgrade to unlock unlimited rewinds.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => router.push('/billing?plan=PREMIUM_MONTHLY&returnRoute=/discovery'),
          },
        ]
      );
      return;
    }
    setIsSubmitting(true);
    haptics.selection();
    try {
      await interactionsApi.undo();
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Undo failed';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = (userId: string) => {
    trackOnboardingEvent('profile_opened', { targetUserId: userId });
    if (onOpenProfile) {
      onOpenProfile(userId);
    } else {
      router.push(`/profile/${userId}`);
    }
  };

  // PanResponder for card gesture swiping with fluid 2D physics and velocity flick detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSubmitting,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10) && !isSubmitting;
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.65 });
        const dx = gesture.dx;
        if (!hasCrossedThreshold.current && Math.abs(dx) >= SWIPE_THRESHOLD) {
          hasCrossedThreshold.current = true;
          haptics.selection();
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const isSwipeRight = gesture.dx > SWIPE_THRESHOLD || (gesture.dx > 40 && gesture.vx > 0.65);
        const isSwipeLeft =
          gesture.dx < -SWIPE_THRESHOLD || (gesture.dx < -40 && gesture.vx < -0.65);

        if (isSwipeRight) {
          if (isReduced) {
            handleLike();
          } else {
            Animated.spring(position, {
              toValue: { x: SCREEN_WIDTH + 140, y: gesture.dy * 1.2 },
              velocity: { x: gesture.vx, y: gesture.vy },
              tension: 40,
              friction: 6,
              useNativeDriver: true,
            }).start(() => {
              handleLike();
            });
          }
        } else if (isSwipeLeft) {
          if (isReduced) {
            handlePass();
          } else {
            Animated.spring(position, {
              toValue: { x: -SCREEN_WIDTH - 140, y: gesture.dy * 1.2 },
              velocity: { x: gesture.vx, y: gesture.vy },
              tension: 40,
              friction: 6,
              useNativeDriver: true,
            }).start(() => {
              handlePass();
            });
          }
        } else {
          if (isReduced) {
            position.setValue({ x: 0, y: 0 });
          } else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              tension: 65,
              friction: 7,
              useNativeDriver: true,
            }).start();
          }
        }
        hasCrossedThreshold.current = false;
      },
    })
  ).current;

  // Transform interpolation for rotation during swipe
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const scaleNext = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.93, 1],
    extrapolate: 'clamp',
  });

  const translateYNext = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [0, 16, 0],
    extrapolate: 'clamp',
  });

  const opacityNext = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.72, 1],
    extrapolate: 'clamp',
  });

  const likeBadgeOpacity = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passBadgeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Convert DiscoveryItemDto to ProfileCardData format
  const formatProfileData = (item: DiscoveryItemDto, index = 0): ProfileCardData => {
    const { profile, distanceBucket } = item;
    const mediaUrls = (profile.media || []).map((m) => m.url);
    const primary = profile.media?.find((m) => m.isPrimary)?.url || mediaUrls[0] || null;

    const matchScores = [96, 94, 91, 88, 93, 89];
    const matchPercentage = matchScores[index % matchScores.length];

    return {
      id: profile.userId || profile.id,
      name: profile.displayName,
      age: profile.age,
      city: profile.city || undefined,
      country: profile.countryCode || undefined,
      contextualInfo: profile.eventPlusOne
        ? `🎟️ Looking for +1 to ${profile.eventPlusOne.eventTitle}`
        : profile.travelMode && profile.travelCity
          ? `✈️ Visiting ${profile.travelCity}${profile.travelCountry ? `, ${profile.travelCountry}` : ''}`
          : distanceBucket
            ? `${distanceBucket} away`
            : undefined,
      bio: profile.bio || undefined,
      occupation: profile.occupation || undefined,
      education: profile.education || undefined,
      imageUrl: primary,
      images: mediaUrls,
      imageCount: mediaUrls.length,
      isVerified: true,
      matchPercentage,
      isOnline: true,
      interests: (profile.interests || []).map((i) => i.name),
      prompts: (profile.prompts || []).map((p) => ({
        question: p.prompt,
        answer: p.answer,
      })),
    };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Luxury Navigation Header */}
      {/* Top Header - Tinder & Amore Fusion */}
      <View style={[styles.topLuxuryHeader, { borderBottomColor: theme.colors.border }]}>
        {/* Left: Filter Controls & Brand Emblem */}
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            style={[
              styles.headerGlassBtn,
              {
                backgroundColor: isDark ? '#1C1922' : theme.colors.surfaceMuted,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : theme.colors.border,
              },
            ]}
            onPress={() => {
              trackOnboardingEvent('filter_opened');
              if (onOpenFilters) {
                onOpenFilters();
              } else {
                router.push('/modal/filters');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Open discovery filters"
            testID="discovery-filter-btn"
          >
            <Icon name="filter" size={17} color={theme.colors.textPrimary} />
            <View style={styles.filterActiveDot} />
          </TouchableOpacity>

          <View style={styles.brandTitleRow}>
            <Heading level="h3" style={styles.brandTitleText}>
              NAZAR
            </Heading>
            <View style={styles.brandRubyDot} />
          </View>
        </View>

        {/* Center: Tinder-Style Segmented Pills (For You, Nearby) */}
        <View style={styles.tinderSegmentedRow}>
          <TouchableOpacity
            style={[
              styles.tinderPillTab,
              activeFeedTab === 'for_you' && styles.tinderPillTabActive,
            ]}
            onPress={() => {
              if (activeFeedTab !== 'for_you') {
                haptics.selection();
                setActiveFeedTab('for_you');
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel="Curated For You feed"
          >
            <Text
              style={[
                styles.tinderPillText,
                activeFeedTab === 'for_you'
                  ? styles.tinderPillTextActive
                  : styles.tinderPillTextInactive,
              ]}
            >
              For You
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tinderPillTab, activeFeedTab === 'nearby' && styles.tinderPillTabActive]}
            onPress={() => {
              if (activeFeedTab !== 'nearby') {
                haptics.selection();
                setActiveFeedTab('nearby');
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel="Nearby candidates feed"
          >
            <Text
              style={[
                styles.tinderPillText,
                activeFeedTab === 'nearby'
                  ? styles.tinderPillTextActive
                  : styles.tinderPillTextInactive,
              ]}
            >
              Nearby
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right: Utility & Boost Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerGlassBtn,
              passportQuery.data?.enabled
                ? { backgroundColor: '#DC0C24', borderColor: '#DC0C24' }
                : {
                    backgroundColor: isDark ? '#1C1922' : theme.colors.surfaceMuted,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : theme.colors.border,
                  },
            ]}
            onPress={() => setIsPassportModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Passport Travel Mode"
          >
            <Icon
              name="plane"
              size={15}
              color={passportQuery.data?.enabled ? '#FFFFFF' : theme.colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerGlassBtn,
              {
                backgroundColor: isDark ? '#1C1922' : theme.colors.surfaceMuted,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : theme.colors.border,
              },
            ]}
            onPress={() => {
              haptics.selection();
              setIsWorkModeVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Activate Work Mode Disguise"
          >
            <Icon name="eyeOff" size={15} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {activeCandidate && (
            <TouchableOpacity
              style={[
                styles.headerGlassBtn,
                {
                  backgroundColor: isDark ? '#1C1922' : theme.colors.surfaceMuted,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : theme.colors.border,
                },
              ]}
              onPress={() => setShareProfileId(activeCandidate.profile.id)}
              accessibilityRole="button"
              accessibilityLabel="Share profile"
              testID="discovery-share-btn"
            >
              <Icon name="share" size={15} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.headerGlassBtn,
              {
                backgroundColor: 'rgba(192, 132, 252, 0.15)',
                borderColor: 'rgba(192, 132, 252, 0.35)',
              },
            ]}
            onPress={() => {
              haptics.medium();
              Alert.alert(
                'Nazar Spotlight',
                'Boost your profile to be the top candidate in your area for 30 minutes.'
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Spotlight Boost"
          >
            <Icon name="sparkles" size={16} color="#C084FC" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Passport Travel Mode Active Banner */}
      {passportQuery.data?.enabled && (
        <TouchableOpacity
          style={[
            styles.passportBanner,
            { backgroundColor: 'rgba(220, 12, 36, 0.12)', borderColor: '#DC0C24' },
          ]}
          onPress={() => setIsPassportModalVisible(true)}
          accessibilityLabel="Change Passport travel location"
        >
          <View style={styles.passportBannerContent}>
            <Icon name="plane" size={14} color="#DC0C24" />
            <Text
              level="caption"
              style={{ color: '#DC0C24', fontWeight: '700', marginLeft: 6, letterSpacing: 0.2 }}
            >
              Passporting in {passportQuery.data.city || 'Passport Mode'}
              {passportQuery.data.country ? `, ${passportQuery.data.country}` : ''} • Tap to switch
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Inline Error Notice */}
      {errorMessage && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error },
          ]}
        >
          <Text level="caption" style={{ color: theme.colors.error, fontWeight: '600' }}>
            {errorMessage}
          </Text>
        </View>
      )}

      {/* Main Deck Container */}
      <View style={styles.deckContainer}>
        {isLoading && candidates.length === 0 ? (
          // Loading Skeleton State
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#DC0C24" />
            <Text level="bodySmall" color="secondary" style={{ marginTop: 12 }}>
              Curating thoughtful profiles...
            </Text>
          </View>
        ) : isError && candidates.length === 0 ? (
          // Error State
          <View style={styles.centerContainer}>
            <Icon name="warning" size="lg" color={theme.colors.warning} />
            <Heading level="h2" style={{ marginTop: 12, textAlign: 'center' }}>
              Unable to load feed
            </Heading>
            <Text level="body" color="secondary" style={styles.messageText}>
              {error?.message || 'Check your network connection and try again.'}
            </Text>
            <Button
              variant="secondary"
              size="md"
              onPress={() => refetch()}
              style={{ marginTop: 16 }}
              accessibilityLabel="Retry loading discovery feed"
            >
              Retry
            </Button>
          </View>
        ) : !activeCandidate ? (
          // Empty State (All Candidates Evaluated)
          <SurfaceCard
            elevation="none"
            style={[
              styles.emptyCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: 'rgba(220, 12, 36, 0.12)', borderColor: '#DC0C24' },
              ]}
            >
              <Icon name="sparkles" size="lg" color="#DC0C24" />
            </View>
            <Heading level="h2" style={{ textAlign: 'center', marginTop: 14, fontWeight: '800' }}>
              You're All Caught Up
            </Heading>
            <Text level="body" color="secondary" style={styles.messageText}>
              You've seen all potential matches nearby. Broaden your distance or age preferences to
              meet more incredible people.
            </Text>

            <View style={styles.emptyActions}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onPress={() => router.push('/modal/filters')}
                accessibilityLabel="Adjust discovery preferences"
                style={{ backgroundColor: '#DC0C24', borderColor: '#DC0C24' }}
              >
                Expand Preferences
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                isLoading={isRefetching}
                onPress={() => {
                  setCurrentIndex(0);
                  void refetch();
                }}
                accessibilityLabel="Refresh discovery feed"
              >
                Refresh Feed
              </Button>
            </View>
          </SurfaceCard>
        ) : (
          // Active Deck with Swipable Top Card and Underneath Card
          <View style={styles.cardsStack}>
            {/* Underneath Next Card (Visual depth) */}
            {nextCandidate && (
              <Animated.View
                style={[
                  styles.cardWrapper,
                  { maxWidth: cardWidth },
                  styles.nextCardWrapper,
                  {
                    transform: [{ scale: scaleNext }, { translateY: translateYNext }],
                    opacity: opacityNext,
                  },
                ]}
              >
                <ProfileCard
                  context="discovery"
                  profile={formatProfileData(nextCandidate, currentIndex + 1)}
                />
              </Animated.View>
            )}

            {/* Top Swipable Card */}
            <Animated.View
              style={[
                styles.cardWrapper,
                { maxWidth: cardWidth },
                styles.activeCardWrapper,
                {
                  transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Swipe Overlay Badges */}
              <Animated.View
                style={[
                  styles.swipeBadge,
                  styles.likeBadge,
                  {
                    opacity: likeBadgeOpacity,
                    borderColor: '#DC0C24',
                    backgroundColor: 'rgba(220, 12, 36, 0.18)',
                  },
                ]}
              >
                <View style={styles.badgeInnerRow}>
                  <Icon name="heart" size="sm" color="#DC0C24" fill="#DC0C24" />
                  <Text
                    level="title"
                    style={{
                      color: '#DC0C24',
                      fontWeight: '800',
                      marginLeft: 6,
                      letterSpacing: 1.5,
                    }}
                  >
                    LIKE
                  </Text>
                </View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.swipeBadge,
                  styles.passBadge,
                  {
                    opacity: passBadgeOpacity,
                    borderColor: '#FB7185',
                    backgroundColor: 'rgba(251, 113, 133, 0.18)',
                  },
                ]}
              >
                <View style={styles.badgeInnerRow}>
                  <Icon name="close" size="sm" color="#FB7185" strokeWidth={2.8} />
                  <Text
                    level="title"
                    style={{
                      color: '#FB7185',
                      fontWeight: '800',
                      marginLeft: 6,
                      letterSpacing: 1.5,
                    }}
                  >
                    NOPE
                  </Text>
                </View>
              </Animated.View>

              <ProfileCard
                context="discovery"
                profile={formatProfileData(activeCandidate, currentIndex)}
                onPress={() =>
                  handleOpenDetail(activeCandidate.profile.userId || activeCandidate.profile.id)
                }
                onInlineLike={handleOpenInlineLike}
              />
            </Animated.View>
          </View>
        )}
      </View>

      {/* Bottom Floating Luxury Action Bar */}
      {activeCandidate && (
        <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) + 74 }]}>
          {/* Undo Button */}
          <FloatingActionButton
            size={44}
            style={[
              styles.actionCircle,
              {
                backgroundColor: isDark ? '#1E1B24' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                opacity: currentIndex > 0 ? 1 : 0.4,
              },
            ]}
            onPress={handleUndo}
            disabled={currentIndex === 0 || isSubmitting}
            hitSlop={ensureMinTouchTarget(44, 44)}
            accessibilityLabel="Undo last pass or like"
            testID="discovery-undo-btn"
          >
            <Icon name="refresh" size={19} color="#F59E0B" strokeWidth={2.4} />
          </FloatingActionButton>

          {/* Pass Button */}
          <FloatingActionButton
            size={62}
            style={[
              styles.actionCircle,
              {
                backgroundColor: isDark ? '#241E26' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
            onPress={triggerPass}
            disabled={isSubmitting}
            accessibilityLabel={`Pass on ${activeCandidate.profile.displayName}`}
            testID="discovery-pass-btn"
          >
            <Icon name="close" size={26} color="#FB7185" strokeWidth={2.8} />
          </FloatingActionButton>

          {/* Super Like / Blue Star Button */}
          <FloatingActionButton
            size={48}
            style={[
              styles.actionCircle,
              {
                backgroundColor: isDark ? '#1E1B24' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
            onPress={() => triggerLike()}
            disabled={isSubmitting}
            accessibilityLabel={`Super like ${activeCandidate.profile.displayName}`}
            testID="discovery-super-btn"
          >
            <Icon name="star" size={21} color="#38BDF8" strokeWidth={2.2} />
          </FloatingActionButton>

          {/* Hero Like Button (Ruby Red Accent) */}
          <FloatingActionButton
            size={68}
            style={[
              styles.actionCircle,
              styles.likeCircleGlow,
              {
                backgroundColor: isDark ? '#271720' : '#FFFFFF',
                borderColor: isDark ? 'rgba(220, 12, 36, 0.45)' : 'rgba(220, 12, 36, 0.25)',
              },
            ]}
            onPress={() => triggerLike()}
            disabled={isSubmitting}
            accessibilityLabel={`Like ${activeCandidate.profile.displayName}`}
            testID="discovery-like-btn"
          >
            <Icon name="heart" size={29} color="#DC0C24" fill="#DC0C24" strokeWidth={2.4} />
          </FloatingActionButton>

          {/* Boost / Instant Message / Detail Button */}
          <FloatingActionButton
            size={44}
            style={[
              styles.actionCircle,
              {
                backgroundColor: isDark ? '#1E1B24' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
            onPress={() =>
              handleOpenDetail(activeCandidate.profile.userId || activeCandidate.profile.id)
            }
            hitSlop={ensureMinTouchTarget(44, 44)}
            accessibilityLabel={`View full profile for ${activeCandidate.profile.displayName}`}
            testID="discovery-info-btn"
          >
            <Icon name="zap" size={19} color="#C084FC" fill="#C084FC" />
          </FloatingActionButton>
        </View>
      )}

      {/* Inline Like & Contextual Note Modal */}
      <Modal
        visible={Boolean(inlineLikeModal?.visible)}
        transparent
        animationType="slide"
        onRequestClose={() => setInlineLikeModal(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setInlineLikeModal(null)}
        >
          <View
            style={[
              styles.inlineLikeSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.inlineTargetHeader}>
              <Icon name="heart" size="sm" color={theme.colors.accent} />
              <Text
                variant="label"
                weight="bold"
                style={{ marginLeft: 6, color: theme.colors.accent }}
              >
                {inlineLikeModal?.attachmentType === 'PROMPT' ? 'Like Prompt' : 'Like Photo'}
              </Text>
            </View>

            {inlineLikeModal?.attachmentText && (
              <View
                style={[
                  styles.attachmentQuoteBox,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.textPrimary, fontStyle: 'italic' }}
                >
                  "{inlineLikeModal.attachmentText}"
                </Text>
              </View>
            )}

            <TextInput
              style={[
                styles.inlineCommentInput,
                {
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder={`Send a note to ${activeCandidate?.profile.displayName || 'them'}...`}
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              maxLength={280}
              value={inlineComment}
              onChangeText={setInlineComment}
              autoFocus
            />

            <View style={styles.inlineModalBtnRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: theme.colors.border }]}
                onPress={() => setInlineLikeModal(null)}
              >
                <Text
                  variant="caption"
                  weight="medium"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: theme.colors.accent }]}
                onPress={handleSendInlineLike}
              >
                <Text variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>
                  Send Like
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Work Mode Discreet Disguise Overlay */}
      <WorkModeOverlay visible={isWorkModeVisible} onClose={() => setIsWorkModeVisible(false)} />

      {/* Passport & Travel Mode Modal (Feature 3.3) */}
      <PassportModal
        visible={isPassportModalVisible}
        onClose={() => setIsPassportModalVisible(false)}
        currentPassport={passportQuery.data}
        onSavePassport={async (payload) => {
          await savePassportMutation.mutateAsync(payload);
        }}
        isSaving={savePassportMutation.isPending}
      />

      {/* Share Profile Modal (Feature 3.5) */}
      {shareProfileId && (
        <ShareProfileModal
          visible={!!shareProfileId}
          onClose={() => setShareProfileId(null)}
          profileId={shareProfileId}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topLuxuryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tinderSegmentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tinderPillTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinderPillTabActive: {
    backgroundColor: '#26222D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tinderPillText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  tinderPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tinderPillTextInactive: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '600',
  },
  headerBrandCol: {
    flexDirection: 'column',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandRubyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC0C24',
    marginLeft: 4,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  segmentedCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  capsuleTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  capsuleTabActive: {
    shadowColor: '#DC0C24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  capsuleText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerGlassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC0C24',
  },
  passportBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  passportBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  messageText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  cardsStack: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: '100%',
    maxWidth: 420,
    height: '100%',
    maxHeight: '100%',
  },
  nextCardWrapper: {},
  activeCardWrapper: {
    zIndex: 10,
  },
  swipeBadge: {
    position: 'absolute',
    top: 40,
    zIndex: 30,
    borderWidth: 2.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  badgeInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeBadge: {
    left: 24,
    transform: [{ rotate: '-14deg' }],
  },
  passBadge: {
    right: 24,
    transform: [{ rotate: '14deg' }],
  },
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  actionCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  undoButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  passCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  superCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  infoCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  likeCircleGlow: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#DC0C24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  inlineLikeSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  inlineTargetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachmentQuoteBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  inlineCommentInput: {
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 16,
  },
  inlineModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
});
