import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Animated,
  useWindowDimensions,
  StatusBar,
  PanResponder,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../../src/design/primitives/Text.js';
import { Icon } from '../../src/design/primitives/Icon.js';
import { haptics } from '../../src/design/haptics/index.js';
import { useReducedMotion } from '../../src/design/motion/index.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();

  // Responsive scale factors based on screen dimensions
  const isCompact = height < 700;
  const cardWidth = Math.min(width * 0.44, 185);
  const cardHeight = Math.min(cardWidth * 1.38, 255);

  // Animation values for smooth entrance
  const entranceAnim = useRef(new Animated.Value(isReducedMotion ? 1 : 0)).current;

  // Swipeable Pill Button State & Animations
  const [pillWidth, setPillWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const thumbScaleAnim = useRef(new Animated.Value(1)).current;
  const pillScaleAnim = useRef(new Animated.Value(1)).current;
  const isConfirmed = useRef(false);
  const hasTriggeredThreshold = useRef(false);

  // Calculate maximum slide distance based on container width
  const maxSlide = useMemo(() => {
    const effectiveWidth = pillWidth > 0 ? pillWidth : Math.max(280, width - 52);
    return Math.max(0, effectiveWidth - 66);
  }, [pillWidth, width]);

  const maxSlideRef = useRef(maxSlide);
  useEffect(() => {
    maxSlideRef.current = maxSlide;
  }, [maxSlide]);

  // Image load fallback states
  const [maleImageError, setMaleImageError] = useState(false);
  const [femaleImageError, setFemaleImageError] = useState(false);

  useEffect(() => {
    trackOnboardingEvent('auth_started', { defaultMethod: 'get_started' });

    if (!isReducedMotion) {
      Animated.spring(entranceAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [isReducedMotion]);

  const handleGetStarted = () => {
    haptics.medium();
    trackOnboardingEvent('onboarding_started', { entryPoint: 'get_started' });
    router.push('/(auth)/login');
  };

  const handleSignIn = () => {
    haptics.light();
    trackOnboardingEvent('onboarding_started', { entryPoint: 'sign_in' });
    router.push('/(auth)/login');
  };

  // Fallback tap trigger: glides smoothly across and initiates Get Started
  const handlePillTap = () => {
    if (isConfirmed.current) return;
    isConfirmed.current = true;
    haptics.medium();
    const currentMax = maxSlideRef.current;
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: currentMax,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(thumbScaleAnim, {
        toValue: 1.0,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(pillScaleAnim, {
        toValue: 1.0,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start(() => {
      haptics.success();
      handleGetStarted();
      setTimeout(() => {
        isConfirmed.current = false;
        slideAnim.setValue(0);
        thumbScaleAnim.setValue(1);
        pillScaleAnim.setValue(1);
      }, 800);
    });
  };

  // Ultra-smooth physics-based PanResponder attached to the entire pill button
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          if (isConfirmed.current) return;
          hasTriggeredThreshold.current = false;
          haptics.light();
          Animated.parallel([
            Animated.spring(thumbScaleAnim, {
              toValue: 1.08,
              tension: 140,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.spring(pillScaleAnim, {
              toValue: 0.985,
              tension: 140,
              friction: 8,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isConfirmed.current) return;
          const currentMax = maxSlideRef.current;
          if (currentMax <= 0) return;

          const clampedX = Math.max(0, Math.min(gestureState.dx, currentMax));
          slideAnim.setValue(clampedX);

          const threshold = currentMax * 0.65;
          if (clampedX >= threshold && !hasTriggeredThreshold.current) {
            hasTriggeredThreshold.current = true;
            haptics.medium();
          } else if (clampedX < threshold && hasTriggeredThreshold.current) {
            hasTriggeredThreshold.current = false;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isConfirmed.current) return;
          const currentMax = maxSlideRef.current;

          // Pure tap without significant swipe: auto-glide to complete
          if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
            handlePillTap();
            return;
          }

          const threshold = currentMax * 0.55;
          const isFlicked = gestureState.vx > 0.38 && gestureState.dx > 25;

          if (gestureState.dx >= threshold || isFlicked) {
            isConfirmed.current = true;
            haptics.success();
            Animated.parallel([
              Animated.spring(slideAnim, {
                toValue: currentMax,
                tension: 90,
                friction: 9,
                useNativeDriver: true,
              }),
              Animated.spring(thumbScaleAnim, {
                toValue: 1.0,
                tension: 90,
                friction: 9,
                useNativeDriver: true,
              }),
              Animated.spring(pillScaleAnim, {
                toValue: 1.0,
                tension: 90,
                friction: 9,
                useNativeDriver: true,
              }),
            ]).start(() => {
              handleGetStarted();
              setTimeout(() => {
                isConfirmed.current = false;
                slideAnim.setValue(0);
                thumbScaleAnim.setValue(1);
                pillScaleAnim.setValue(1);
              }, 800);
            });
          } else {
            haptics.selection();
            Animated.parallel([
              Animated.spring(slideAnim, {
                toValue: 0,
                tension: 85,
                friction: 8,
                useNativeDriver: true,
              }),
              Animated.spring(thumbScaleAnim, {
                toValue: 1.0,
                tension: 85,
                friction: 8,
                useNativeDriver: true,
              }),
              Animated.spring(pillScaleAnim, {
                toValue: 1.0,
                tension: 85,
                friction: 8,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          if (isConfirmed.current) return;
          Animated.parallel([
            Animated.spring(slideAnim, {
              toValue: 0,
              tension: 85,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.spring(thumbScaleAnim, {
              toValue: 1.0,
              tension: 85,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.spring(pillScaleAnim, {
              toValue: 1.0,
              tension: 85,
              friction: 8,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [slideAnim, thumbScaleAnim, pillScaleAnim]
  );

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Luminous Ember-to-Dark Gradient Background */}
      <LinearGradient
        colors={['#A82811', '#751B0A', '#341009', '#181417', '#100F12', '#0A090B']}
        locations={[0, 0.18, 0.42, 0.65, 0.85, 1.0]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Branding */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>Nazar</Text>
        </View>

        {/* Hero Interactive Visual: Dual Overlapping Profile Cards */}
        <View style={[styles.heroSection, { height: isCompact ? 240 : 290 }]}>
          {/* Card 1: Left / Background Profile */}
          <Animated.View
            style={[
              styles.cardWrapper,
              styles.leftCardWrapper,
              {
                width: cardWidth,
                height: cardHeight,
                transform: [
                  {
                    rotate: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-13deg'],
                    }),
                  },
                  {
                    scale: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                  { translateY: 8 },
                ],
              },
            ]}
          >
            <View style={styles.cardInner}>
              {!maleImageError ? (
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
                  }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() => setMaleImageError(true)}
                />
              ) : (
                <LinearGradient colors={['#3F3F46', '#18181B']} style={styles.cardImagePlaceholder}>
                  <Text style={styles.placeholderInitials}>JM</Text>
                </LinearGradient>
              )}

              {/* Bottom vignette overlay for text legibility */}
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.9)']}
                locations={[0, 0.5, 1]}
                style={styles.cardVignette}
              >
                <Text style={styles.cardName} numberOfLines={1}>
                  Jastin M, 28
                </Text>
                <Text style={styles.cardLocation} numberOfLines={1}>
                  New York, USA
                </Text>
              </LinearGradient>
            </View>

            {/* Left Floating Badge: Violet Gift / Sparkle Icon */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => haptics.selection()}
              style={[styles.floatingBadge, styles.leftPurpleBadge]}
              accessibilityLabel="Special Connections Badge"
              accessibilityRole="image"
            >
              <Icon name="sparkles" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* Card 2: Right / Foreground Profile */}
          <Animated.View
            style={[
              styles.cardWrapper,
              styles.rightCardWrapper,
              {
                width: cardWidth,
                height: cardHeight,
                transform: [
                  {
                    rotate: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '11deg'],
                    }),
                  },
                  {
                    scale: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                  { translateY: -6 },
                ],
              },
            ]}
          >
            <View style={[styles.cardInner, styles.frontCardShadow]}>
              {!femaleImageError ? (
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
                  }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() => setFemaleImageError(true)}
                />
              ) : (
                <LinearGradient colors={['#4C1D95', '#1E1B4B']} style={styles.cardImagePlaceholder}>
                  <Text style={styles.placeholderInitials}>JL</Text>
                </LinearGradient>
              )}

              {/* Bottom vignette overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.9)']}
                locations={[0, 0.5, 1]}
                style={styles.cardVignette}
              >
                <View style={styles.nameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    Julia Lode, 27
                  </Text>
                  <View style={styles.onlineDot} />
                </View>
                <Text style={styles.cardLocation} numberOfLines={1}>
                  Los Angeles
                </Text>
              </LinearGradient>
            </View>

            {/* Top-Left Floating Badge: Blue Message Bubble */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => haptics.selection()}
              style={[styles.floatingBadge, styles.topBlueBadge]}
              accessibilityLabel="Direct Message Badge"
              accessibilityRole="image"
            >
              <Icon name="message" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Bottom-Right Floating Badge: Red Heart */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => haptics.selection()}
              style={[styles.floatingBadge, styles.bottomHeartBadge]}
              accessibilityLabel="Instant Match Like Badge"
              accessibilityRole="image"
            >
              <Icon name="heart" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Value Proposition & Typography */}
        <View style={[styles.textSection, isCompact && { marginTop: 4 }]}>
          <View style={styles.headingContainer}>
            <RNText style={[styles.headingFindYour, isCompact && styles.compactHeading]}>
              Find Your
            </RNText>
            <View style={styles.headingMatchRow}>
              <RNText style={[styles.headingPerfect, isCompact && styles.compactHeading]}>
                Perfect{' '}
              </RNText>
              <RNText style={[styles.headingMatch, isCompact && styles.compactHeading]}>
                Match
              </RNText>
            </View>
          </View>

          <RNText style={styles.subtitle}>
            Meet New People, Spark Real Connections,{'\n'}And See Where It Goes.
          </RNText>
        </View>

        {/* Bottom Interactive Area (Swipeable Get Started & Sign In) */}
        <View style={styles.actionsSection}>
          {/* Swipeable "Get Started" Pill Button */}
          <Animated.View
            style={[
              styles.pillContainer,
              {
                transform: [{ scale: pillScaleAnim }],
              },
            ]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && w !== pillWidth) {
                setPillWidth(w);
              }
            }}
            {...panResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Get Started with Nazar"
            accessibilityHint="Swipe the heart to the right to get started"
          >
            {/* Centered "Get Started" Label: Stays crisp and readable throughout the swipe */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pillLabelContainer,
                {
                  opacity: slideAnim.interpolate({
                    inputRange: [0, (maxSlide || 200) * 0.75, maxSlide || 200],
                    outputRange: [1, 0.85, 0.15],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <RNText style={styles.pillLabel}>Get Started</RNText>
            </Animated.View>

            {/* Right Triple Chevron Indicator */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.chevronGroup,
                {
                  opacity: slideAnim.interpolate({
                    inputRange: [0, (maxSlide || 200) * 0.8, maxSlide || 200],
                    outputRange: [1, 0.75, 0.15],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <Icon name="chevron" size={15} color="#52525B" direction="right" style={{ marginRight: -7 }} />
              <Icon name="chevron" size={15} color="#A1A1AA" direction="right" style={{ marginRight: -7 }} />
              <Icon name="chevron" size={15} color="#FFFFFF" direction="right" />
            </Animated.View>

            {/* Draggable Red Heart Circle Thumb */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pillHeartCircle,
                {
                  transform: [
                    { translateX: slideAnim },
                    { scale: thumbScaleAnim },
                  ],
                },
              ]}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: slideAnim.interpolate({
                        inputRange: [0, (maxSlide || 200) * 0.5, maxSlide || 200],
                        outputRange: ['0deg', '12deg', '0deg'],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      scale: slideAnim.interpolate({
                        inputRange: [0, (maxSlide || 200) * 0.5, maxSlide || 200],
                        outputRange: [1, 1.12, 1.04],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <Icon name="heart" size={24} color="#FFFFFF" />
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Secondary Sign In Option */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Already have an account, Sign In"
          >
            <RNText style={styles.signInText}>
              Already have an account? <RNText style={styles.signInHighlight}>Sign In</RNText>
            </RNText>
          </TouchableOpacity>

          {/* Legal Notice */}
          <RNText style={styles.legalNotice}>
            By continuing, you agree to our Terms of Service & Privacy Policy.
          </RNText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0A090B',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    marginTop: 8,
  },
  cardWrapper: {
    position: 'absolute',
    borderRadius: 24,
  },
  leftCardWrapper: {
    left: '12%',
    zIndex: 1,
  },
  rightCardWrapper: {
    right: '12%',
    zIndex: 2,
  },
  cardInner: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1C1917',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  frontCardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitials: {
    color: '#A1A1AA',
    fontSize: 28,
    fontWeight: '700',
  },
  cardVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    marginLeft: 6,
  },
  cardLocation: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  floatingBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  leftPurpleBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    left: -14,
    bottom: 64,
    zIndex: 10,
  },
  topBlueBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    left: -14,
    top: -10,
    zIndex: 10,
  },
  bottomHeartBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EA3829',
    right: -12,
    bottom: 44,
    zIndex: 10,
    shadowColor: '#EA3829',
    shadowOpacity: 0.6,
  },
  textSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 6,
    width: '100%',
  },
  headingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  headingFindYour: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  headingMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headingPerfect: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: '#E64A19',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  headingMatch: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  compactHeading: {
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
    letterSpacing: 0.1,
  },
  actionsSection: {
    width: '100%',
    paddingHorizontal: 6,
    gap: 12,
    marginTop: 8,
  },
  pillContainer: {
    height: 64,
    borderRadius: 32,
    backgroundColor: '#26262A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  pillLabelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chevronGroup: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillHeartCircle: {
    position: 'absolute',
    left: 6,
    top: 5,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E63920',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  signInText: {
    color: '#A1A1AA',
    fontSize: 14.5,
    fontWeight: '500',
  },
  signInHighlight: {
    color: '#E64A19',
    fontWeight: '700',
  },
  legalNotice: {
    color: '#71717A',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: -4,
  },
});
