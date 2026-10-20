import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Text as RNText,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Camera,
  Flame,
  Heart,
  BookOpen,
  SlidersHorizontal,
  Award,
  Shield,
} from 'lucide-react-native';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';
import { useReducedMotion } from '../../src/design/motion/index.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';

interface RoadmapStage {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  readonly xPct: number;
  readonly yPct: number;
  readonly labelOffsetX?: number;
  readonly labelOffsetY?: number;
}

const ROADMAP_STAGES: readonly RoadmapStage[] = [
  {
    id: 'basics',
    number: '1',
    label: '1. The Basics',
    icon: User,
    xPct: 25.86,
    yPct: 10.88,
    labelOffsetY: 4,
  },
  {
    id: 'photos',
    number: '2',
    label: '2. Photos',
    icon: Camera,
    xPct: 81.9,
    yPct: 12.64,
    labelOffsetX: -14,
  },
  {
    id: 'passions',
    number: '3',
    label: '3. Passions',
    icon: Flame,
    xPct: 42.03,
    yPct: 30.7,
  },
  {
    id: 'lifestyle',
    number: '4',
    label: '4. Lifestyle',
    icon: Heart,
    xPct: 74.35,
    yPct: 50.88,
  },
  {
    id: 'prompts',
    number: '5',
    label: '5. Prompts',
    icon: BookOpen,
    xPct: 42.03,
    yPct: 72.85,
  },
  {
    id: 'preferences',
    number: '6',
    label: '6. Preferences',
    icon: SlidersHorizontal,
    xPct: 18.32,
    yPct: 92.05,
  },
  {
    id: 'launch',
    number: '7',
    label: '7. Launch',
    icon: Award,
    xPct: 71.12,
    yPct: 96.44,
  },
];

// Exact serpentine curve concept from the reference screenshot scaled vertically for comfortable spacing
const SERPENTINE_PATH =
  'M 120,79.4 ' +
  'C 195,108.8 270,44.8 380,92.2 ' +
  'C 425,128.0 415,236.8 300,230.4 ' +
  'C 245,227.8 225,224.0 195,224.0 ' +
  'C 115,224.0 60,262.4 70,339.2 ' +
  'C 80,416.0 240,358.4 345,371.2 ' +
  'C 425,381.4 415,505.6 285,524.8 ' +
  'C 205,535.0 165,531.2 125,531.2 ' +
  'C 60,531.2 65,627.2 85,672.0 ' +
  'C 115,716.8 220,710.4 330,704.0';

export default function OnboardingIntroScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const { width: windowWidth } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();

  // Active highlighted starting milestone (Step 1 is starting milestone)
  const activeStageIndex = 0;

  // Load Folkra brand typography
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.otf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  // Responsive canvas sizing matching the exact reference viewBox 464x730
  const availableWidth = Math.min(windowWidth - 32, maxContentWidth || 480, 420);
  const roadmapCanvasHeight = Math.round(availableWidth * (730 / 464));

  // Animated scroll listener for glossy top vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(isReducedMotion ? 1 : 0)).current;
  const headerTranslateY = useRef(new Animated.Value(isReducedMotion ? 0 : -16)).current;
  const pathOpacity = useRef(new Animated.Value(isReducedMotion ? 1 : 0)).current;

  const nodeAnims = useRef(
    ROADMAP_STAGES.map(() => ({
      scale: new Animated.Value(isReducedMotion ? 1 : 0.6),
      opacity: new Animated.Value(isReducedMotion ? 1 : 0),
    }))
  ).current;

  const fallbackAnim = useRef({
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
  }).current;

  const bottomDockOpacity = useRef(new Animated.Value(isReducedMotion ? 1 : 0)).current;
  const bottomDockTranslateY = useRef(new Animated.Value(isReducedMotion ? 0 : 20)).current;

  useEffect(() => {
    if (isReducedMotion) {
      headerOpacity.setValue(1);
      headerTranslateY.setValue(0);
      pathOpacity.setValue(1);
      nodeAnims.forEach((anim) => {
        anim.scale.setValue(1);
        anim.opacity.setValue(1);
      });
      bottomDockOpacity.setValue(1);
      bottomDockTranslateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(pathOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.stagger(
        90,
        nodeAnims.map((anim) =>
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 6,
              tension: 55,
              useNativeDriver: true,
            }),
          ])
        )
      ),
      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(bottomDockOpacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.spring(bottomDockTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [isReducedMotion]);

  const handleStart = () => {
    haptics.impactMedium();
    trackOnboardingEvent('profile_started', { entryPoint: 'intro_begin' });
    router.push('/(onboarding)/profile-setup');
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#09090C' : '#F8F8FA' }]}>
      {/* Glossy, Faded, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glossyTopOverlay,
          {
            height: Math.max(insets.top + 54, 70),
            opacity: headerGlossOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(9, 9, 12, 0.98)',
                  'rgba(9, 9, 12, 0.92)',
                  'rgba(9, 9, 12, 0.70)',
                  'rgba(9, 9, 12, 0.28)',
                  'rgba(9, 9, 12, 0.0)',
                ]
              : [
                  'rgba(248, 248, 250, 0.98)',
                  'rgba(248, 248, 250, 0.92)',
                  'rgba(248, 248, 250, 0.70)',
                  'rgba(248, 248, 250, 0.28)',
                  'rgba(248, 248, 250, 0.0)',
                ]
          }
          locations={[0, 0.4, 0.68, 0.88, 1.0]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255, 255, 255, 0.08)',
                  'rgba(255, 255, 255, 0.03)',
                  'rgba(255, 255, 255, 0.0)',
                ]
              : [
                  'rgba(255, 255, 255, 0.70)',
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.0)',
                ]
          }
          locations={[0, 0.45, 1.0]}
          style={styles.glossySheenLayer}
        />
      </Animated.View>

      {/* Floating Encircled Circular Back Button on top left */}
      <TouchableOpacity
        onPress={handleBack}
        style={[
          styles.encircledBackButton,
          {
            top: Math.max(insets.top + 8, 16),
            left: Math.max(insets.left + 16, 16),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="onboarding-back-button"
      >
        <ArrowLeft size={19} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      {/* Main Roadmap Scroll Area */}
      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            maxWidth: maxContentWidth || 540,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 58, 68),
            paddingBottom: Math.max(insets.bottom + 150, 170),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Block */}
        <Animated.View
          style={[
            styles.headerSection,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          {/* Subtle Ambient Glow Aura */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 36, 0, 0.14)', 'rgba(255, 36, 0, 0.0)']
                : ['rgba(255, 36, 0, 0.08)', 'rgba(255, 36, 0, 0.0)']
            }
            style={styles.ambientAura}
          />

          {/* Workflow Header Label (Clean text without tabular box) */}
          <View style={styles.journeyIndicator}>
            <View style={[styles.badgePulseDot, { backgroundColor: '#FF2400' }]} />
            <RNText
              style={[
                styles.journeyBadgeText,
                {
                  color: isDark ? '#E4E4E7' : '#3F3F46',
                  fontFamily: folkraFont,
                },
              ]}
            >
              7-STAGE ROADMAP
            </RNText>
          </View>

          {/* Main Title in Brand Font */}
          <RNText
            style={[
              styles.mainTitle,
              {
                color: theme.colors.textPrimary,
                fontFamily: folkraFont,
              },
            ]}
          >
            Build your story on <RNText style={{ color: '#FF2400' }}>Nazar</RNText>
          </RNText>

          <RNText
            style={[
              styles.subtitleNarrative,
              {
                color: theme.colors.textSecondary,
              },
            ]}
          >
            A mindful journey designed for intentional connection. Tap any milestone along the path
            to explore.
          </RNText>
        </Animated.View>

        {/* Serpentine Winding Roadmap Canvas */}
        <View
          style={[
            styles.roadmapCanvasContainer,
            {
              width: availableWidth,
              height: roadmapCanvasHeight,
            },
          ]}
        >
          {/* Continuous Curved Serpentine SVG Path */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: pathOpacity }]}>
            <Svg viewBox="0 0 464 730" width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="solidPathFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FF2400" stopOpacity={1} />
                  <Stop offset="90%" stopColor="#FF2400" stopOpacity={1} />
                  <Stop offset="96%" stopColor="#FF2400" stopOpacity={0.8} />
                  <Stop offset="100%" stopColor="#FF2400" stopOpacity={0.35} />
                </SvgLinearGradient>
              </Defs>

              <Path
                d={SERPENTINE_PATH}
                fill="none"
                stroke="url(#solidPathFade)"
                strokeWidth={11}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>

          {/* Milestone Node Buttons & Labels Positioned Along the Serpentine Curve */}
          {ROADMAP_STAGES.map((stage, idx) => {
            const isSelected = activeStageIndex === idx;
            const anim = nodeAnims[idx] ?? fallbackAnim;
            const StageIcon = stage.icon;

            return (
              <Animated.View
                key={stage.id}
                style={[
                  styles.nodeAnchor,
                  {
                    left: `${stage.xPct}%`,
                    top: `${stage.yPct}%`,
                    opacity: anim.opacity,
                    transform: [{ scale: anim.scale }],
                  },
                ]}
              >
                {/* Luminous Pulsing Glow Halo for Selected Milestone (The Basics) */}
                {isSelected && (
                  <View
                    style={[
                      styles.nodeAuraGlow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 36, 0, 0.22)'
                          : 'rgba(255, 36, 0, 0.14)',
                        borderColor: isDark ? 'rgba(255, 36, 0, 0.55)' : 'rgba(255, 36, 0, 0.35)',
                        shadowColor: '#FF2400',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: isDark ? 0.6 : 0.35,
                        shadowRadius: 14,
                        elevation: 6,
                      },
                    ]}
                  />
                )}

                {/* Milestone Node Circle Disc (100% Round & Non-clickable) */}
                <View
                  style={[
                    styles.nodeDisc,
                    {
                      backgroundColor: isSelected ? '#FFFFFF' : '#FF2400',
                      shadowColor: '#FF2400',
                      shadowOpacity: isSelected ? (isDark ? 0.6 : 0.3) : isDark ? 0.45 : 0.25,
                      shadowRadius: isSelected ? 12 : 8,
                      borderColor: isSelected
                        ? '#FFFFFF'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.24)'
                          : 'rgba(0, 0, 0, 0.10)',
                    },
                  ]}
                  accessibilityLabel={stage.label}
                >
                  <StageIcon
                    size={22}
                    color={isSelected ? '#FF2400' : '#FFFFFF'}
                    strokeWidth={2.4}
                  />
                </View>

                {/* Milestone Label Underneath (Clean floating typography without tabular box) */}
                <View
                  style={[
                    styles.nodeLabelWrapper,
                    stage.labelOffsetY ? { marginTop: 8 + stage.labelOffsetY } : null,
                    stage.labelOffsetX ? { transform: [{ translateX: stage.labelOffsetX }] } : null,
                  ]}
                >
                  <RNText
                    style={[
                      styles.nodeLabelText,
                      {
                        color: isSelected
                          ? isDark
                            ? '#FFFFFF'
                            : '#000000'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.85)'
                            : 'rgba(0, 0, 0, 0.75)',
                        fontWeight: isSelected ? '700' : '600',
                        fontFamily: folkraFont || 'Folkra',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {stage.label}
                  </RNText>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* Floating Modern Action Dock */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.actionDock,
          {
            paddingBottom: Math.max(insets.bottom + 14, 20),
            opacity: bottomDockOpacity,
            transform: [{ translateY: bottomDockTranslateY }],
          },
        ]}
      >
        {/* Soft, Natural Feathered Fade Above the Button */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(9, 9, 12, 0.0)',
                  'rgba(9, 9, 12, 0.05)',
                  'rgba(9, 9, 12, 0.16)',
                  'rgba(9, 9, 12, 0.38)',
                  'rgba(9, 9, 12, 0.68)',
                  'rgba(9, 9, 12, 0.90)',
                  'rgba(9, 9, 12, 1.0)',
                  'rgba(9, 9, 12, 1.0)',
                ]
              : [
                  'rgba(248, 248, 250, 0.0)',
                  'rgba(248, 248, 250, 0.05)',
                  'rgba(248, 248, 250, 0.16)',
                  'rgba(248, 248, 250, 0.38)',
                  'rgba(248, 248, 250, 0.68)',
                  'rgba(248, 248, 250, 0.90)',
                  'rgba(248, 248, 250, 1.0)',
                  'rgba(248, 248, 250, 1.0)',
                ]
          }
          locations={[0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 1.0]}
          style={styles.dockGradientBackdrop}
          pointerEvents="none"
        />

        <View style={[styles.dockInner, { maxWidth: maxContentWidth || 540 }]}>
          {/* Tactile Primary CTA Button - Luxury White Form */}
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.88}
            style={[
              styles.primaryStartButton,
              {
                backgroundColor: '#FFFFFF',
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.32 : 0.12,
                borderWidth: isDark ? 0 : 1,
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Begin Profile Creation"
            testID="begin-profile-creation-btn"
          >
            <RNText
              style={[styles.primaryButtonLabel, folkraFont ? { fontFamily: folkraFont } : null]}
            >
              Begin Profile Creation
            </RNText>

            <View style={styles.buttonArrowCircle}>
              <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          {/* Privacy & Reassurance Seal */}
          <View style={styles.reassuranceRow}>
            <View style={styles.reassuranceIconWrapper}>
              <Shield size={13} color={theme.colors.textTertiary} strokeWidth={2.2} />
            </View>
            <RNText style={[styles.reassuranceText, { color: theme.colors.textTertiary }]}>
              Private draft. You can review and refine everything before publishing.
            </RNText>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  encircledBackButton: {
    position: 'absolute',
    zIndex: 25,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  glossyTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  glossySheenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    position: 'relative',
  },
  ambientAura: {
    position: 'absolute',
    top: -30,
    left: '10%',
    right: '10%',
    height: 140,
    borderRadius: 70,
    opacity: 0.8,
  },
  journeyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 7,
  },
  badgePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  journeyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  mainTitle: {
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  subtitleNarrative: {
    textAlign: 'center',
    fontSize: 13.5,
    lineHeight: 20,
    maxWidth: 320,
    letterSpacing: 0.1,
  },
  roadmapCanvasContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginTop: 10,
    marginBottom: 24,
  },
  nodeAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    marginLeft: -60,
    marginTop: -26,
    zIndex: 10,
  },
  nodeAuraGlow: {
    position: 'absolute',
    top: -7,
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    zIndex: 1,
  },
  nodeDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 2,
  },
  nodeLabelWrapper: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  nodeLabelText: {
    fontFamily: 'Folkra',
    fontSize: 11.5,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  actionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 20,
    zIndex: 30,
  },
  dockGradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 10,
  },
  primaryStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: 28,
    paddingLeft: 24,
    paddingRight: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonLabelGroup: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontFamily: 'Folkra',
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryButtonSubLabel: {
    fontFamily: 'Folkra',
    color: 'rgba(0, 0, 0, 0.65)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  buttonArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 7,
  },
  reassuranceIconWrapper: {
    paddingTop: Platform.OS === 'ios' ? 1.5 : 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceText: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.1,
    textAlign: 'left',
  },
});
