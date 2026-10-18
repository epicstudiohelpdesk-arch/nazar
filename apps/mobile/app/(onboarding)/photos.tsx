import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  Alert,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  X,
  AlertCircle,
  ShieldCheck,
  Sun,
  UserCheck,
  Compass,
  Camera,
  ImagePlus,
  SlidersHorizontal,
  Check,
  RotateCw,
  RotateCcw,
  Crop,
  Grid3X3,
} from 'lucide-react-native';
import type { MediaItemResponse } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';
import { SmoothBottomSheetModal } from '../../src/design/components/modal/SmoothBottomSheetModal.js';

// ============================================================================
// Real Editorial Portrait Filters
// ============================================================================

export interface PhotoFilter {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly gradientColors?: readonly [string, string, ...string[]];
  readonly locations?: readonly number[];
  readonly vignette?: boolean;
}

export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  {
    id: 'original',
    name: 'Original',
    tagline: 'Authentic RAW portrait',
  },
  {
    id: 'portra_400',
    name: 'Portra 400',
    tagline: 'Warm skin tones & highlights',
    gradientColors: [
      'rgba(255, 237, 213, 0.16)',
      'rgba(251, 191, 36, 0.10)',
      'rgba(249, 115, 22, 0.08)',
    ],
    locations: [0, 0.45, 1],
    vignette: true,
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    tagline: 'Honeyed golden radiance',
    gradientColors: [
      'rgba(251, 191, 36, 0.20)',
      'rgba(245, 158, 11, 0.14)',
      'rgba(217, 119, 6, 0.10)',
    ],
    locations: [0, 0.5, 1],
    vignette: true,
  },
  {
    id: 'warm_ember',
    name: 'Warm Ember',
    tagline: 'Amber undertones & warmth',
    gradientColors: [
      'rgba(255, 125, 45, 0.16)',
      'rgba(234, 88, 12, 0.12)',
      'rgba(180, 83, 9, 0.08)',
    ],
    locations: [0, 0.55, 1],
    vignette: true,
  },
  {
    id: 'classic_chrome',
    name: 'Classic Chrome',
    tagline: 'Fujifilm documentary depth',
    gradientColors: ['rgba(71, 85, 105, 0.14)', 'rgba(51, 65, 85, 0.18)', 'rgba(15, 23, 42, 0.24)'],
    locations: [0, 0.55, 1],
    vignette: true,
  },
  {
    id: 'cinematic_teal',
    name: 'Cinematic Teal',
    tagline: 'Moody shadows & speculars',
    gradientColors: [
      'rgba(45, 212, 191, 0.14)',
      'rgba(13, 148, 136, 0.10)',
      'rgba(15, 23, 42, 0.24)',
    ],
    locations: [0, 0.45, 1],
    vignette: true,
  },
  {
    id: 'velvet_rose',
    name: 'Velvet Rose',
    tagline: 'Romantic champagne blush',
    gradientColors: [
      'rgba(251, 113, 133, 0.15)',
      'rgba(244, 63, 94, 0.10)',
      'rgba(190, 24, 93, 0.08)',
    ],
    locations: [0, 0.5, 1],
    vignette: true,
  },
  {
    id: 'editorial_noir',
    name: 'Noir Matte',
    tagline: 'High-contrast monochrome',
    gradientColors: ['rgba(15, 23, 42, 0.38)', 'rgba(24, 24, 27, 0.46)', 'rgba(9, 9, 11, 0.54)'],
    locations: [0, 0.5, 1],
    vignette: true,
  },
  {
    id: 'silver_gelatin',
    name: 'Silver Gelatin',
    tagline: 'Timeless silver-halide film',
    gradientColors: [
      'rgba(244, 244, 245, 0.16)',
      'rgba(113, 113, 122, 0.30)',
      'rgba(24, 24, 27, 0.44)',
    ],
    locations: [0, 0.4, 1],
    vignette: true,
  },
  {
    id: 'nordic_cool',
    name: 'Nordic Cool',
    tagline: 'Clean daylight & minimalism',
    gradientColors: [
      'rgba(186, 230, 253, 0.14)',
      'rgba(125, 211, 252, 0.08)',
      'rgba(71, 85, 105, 0.10)',
    ],
    locations: [0, 0.5, 1],
    vignette: false,
  },
  {
    id: 'ektar_100',
    name: 'Ektar 100',
    tagline: 'Vivid fine-grain color',
    gradientColors: [
      'rgba(253, 186, 116, 0.14)',
      'rgba(239, 68, 68, 0.09)',
      'rgba(168, 85, 247, 0.07)',
    ],
    locations: [0, 0.55, 1],
    vignette: true,
  },
  {
    id: 'tokyo_night',
    name: 'Tokyo Night',
    tagline: 'Indigo twilight & amber glow',
    gradientColors: [
      'rgba(99, 102, 241, 0.15)',
      'rgba(79, 70, 229, 0.12)',
      'rgba(15, 23, 42, 0.32)',
    ],
    locations: [0, 0.5, 1],
    vignette: true,
  },
];

interface SlotConfig {
  readonly index: number;
  readonly prompt: string;
  readonly isCover?: boolean;
}

const COVER_SLOT: SlotConfig = {
  index: 0,
  prompt: 'Main cover portrait',
  isCover: true,
};

const SECONDARY_SLOTS: readonly SlotConfig[] = [
  { index: 1, prompt: 'Full length' },
  { index: 2, prompt: 'Candid smile' },
  { index: 3, prompt: 'Your passion' },
  { index: 4, prompt: 'Travel / Outing' },
  { index: 5, prompt: 'Casual vibe' },
];

const PHOTO_SLOTS: readonly SlotConfig[] = [COVER_SLOT, ...SECONDARY_SLOTS];

export default function OnboardingPhotosScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

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

  // Living Studio Breathing / Pulse Animation for the Cover Viewfinder
  const studioPulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(studioPulseAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(studioPulseAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [studioPulseAnim]);

  const studioPulseScale = studioPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const studioPulseOpacity = studioPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.38],
  });

  const studioDotOpacity = studioPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  // Load Folkra brand typography
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const {
    draftPhotos,
    setDraftPhotos,
    addDraftPhoto,
    removeDraftPhoto,
    setPrimaryDraftPhoto,
    updateDraftPhotoFilter,
  } = useOnboardingStore();

  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isPickerModalVisible, setIsPickerModalVisible] = useState(false);
  const [isStudioModalVisible, setIsStudioModalVisible] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('original');
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  // Interactive Crop & Resize (Framing Viewfinder) States inside Portrait Studio
  const [cropScale, setCropScale] = useState(1);
  const [cropTranslate, setCropTranslate] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 340,
    height: 340,
  });

  const cropScaleRef = useRef(1);
  const cropPanRef = useRef({ x: 0, y: 0 });
  const viewportSizeRef = useRef<{ width: number; height: number }>({ width: 340, height: 340 });
  const imageNaturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  const prevTouchCountRef = useRef(0);
  const prevTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const prevPinchDistRef = useRef<number | null>(null);
  const prevPinchMidRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const gridOpacityAnim = useRef(new Animated.Value(0)).current;

  // Synchronize ref mirrors with state for high-frequency gesture access
  useEffect(() => {
    viewportSizeRef.current = viewportSize;
  }, [viewportSize]);

  useEffect(() => {
    imageNaturalSizeRef.current = imageNaturalSize;
  }, [imageNaturalSize]);

  // Reset crop & measure image whenever a new photo URI is staged
  useEffect(() => {
    if (pendingPhotoUri) {
      cropScaleRef.current = 1.0;
      cropPanRef.current = { x: 0, y: 0 };
      scaleAnim.setValue(1.0);
      panAnim.setValue({ x: 0, y: 0 });
      setCropScale(1.0);
      setCropTranslate({ x: 0, y: 0 });

      Image.getSize(
        pendingPhotoUri,
        (width, height) => {
          setImageNaturalSize({ width, height });
          imageNaturalSizeRef.current = { width, height };
        },
        () => {
          setImageNaturalSize({ width: 1080, height: 1350 });
          imageNaturalSizeRef.current = { width: 1080, height: 1350 };
        }
      );
    }
  }, [pendingPhotoUri]);

  // Smooth fade for rule of thirds compositional grid
  useEffect(() => {
    Animated.timing(gridOpacityAnim, {
      toValue: isInteracting || showGrid ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [isInteracting, showGrid]);

  // Pure mathematical helper to compute image base size and allowable pan boundaries
  const calculatePanBounds = (
    targetScale: number,
    viewportW: number,
    viewportH: number,
    naturalW: number,
    naturalH: number
  ) => {
    const scaleRatio = Math.max(viewportW / naturalW, viewportH / naturalH);
    const baseW = naturalW * scaleRatio;
    const baseH = naturalH * scaleRatio;
    const renderedW = baseW * targetScale;
    const renderedH = baseH * targetScale;
    const maxPanX = Math.max(0, (renderedW - viewportW) / 2);
    const maxPanY = Math.max(0, (renderedH - viewportH) / 2);
    return {
      baseW,
      baseH,
      minX: -maxPanX,
      maxX: maxPanX,
      minY: -maxPanY,
      maxY: maxPanY,
    };
  };

  // Instant luxury double-tap toggle between 1.0x overview and 1.75x portrait zoom
  const handleDoubleTap = () => {
    const contW = viewportSizeRef.current.width || 340;
    const contH = viewportSizeRef.current.height || 340;
    const origW = imageNaturalSizeRef.current?.width || contW;
    const origH = imageNaturalSizeRef.current?.height || contH;

    const targetScale = cropScaleRef.current > 1.15 ? 1.0 : 1.75;
    const bounds = calculatePanBounds(targetScale, contW, contH, origW, origH);
    const targetX =
      targetScale === 1.0 ? 0 : Math.max(bounds.minX, Math.min(bounds.maxX, cropPanRef.current.x));
    const targetY =
      targetScale === 1.0 ? 0 : Math.max(bounds.minY, Math.min(bounds.maxY, cropPanRef.current.y));

    cropScaleRef.current = targetScale;
    cropPanRef.current = { x: targetX, y: targetY };

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: targetScale,
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.spring(panAnim, {
        toValue: { x: targetX, y: targetY },
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();

    setCropScale(targetScale);
    setCropTranslate({ x: targetX, y: targetY });
    haptics.impactLight();
  };

  // Ultra-fluid 60/120fps PanResponder with Euclidean multi-touch tracking, focal zoom & rubber-banding
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setIsInteracting(true);
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;

        // Double-tap snap toggle
        const now = Date.now();
        if (numTouches === 1 && now - lastTapTimeRef.current < 280) {
          lastTapTimeRef.current = 0;
          handleDoubleTap();
          return;
        }
        lastTapTimeRef.current = now;

        const t0 = touches[0];
        const t1 = touches[1];
        prevTouchCountRef.current = numTouches;
        if (numTouches === 1 && t0) {
          prevTouchPosRef.current = { x: t0.pageX, y: t0.pageY };
          prevPinchDistRef.current = null;
          prevPinchMidRef.current = null;
        } else if (numTouches >= 2 && t0 && t1) {
          const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          const midX = (t0.pageX + t1.pageX) / 2;
          const midY = (t0.pageY + t1.pageY) / 2;
          prevPinchDistRef.current = dist;
          prevPinchMidRef.current = { x: midX, y: midY };
          prevTouchPosRef.current = null;
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        const numTouches = touches.length;
        if (numTouches === 0) return;

        const contW = viewportSizeRef.current.width || 340;
        const contH = viewportSizeRef.current.height || 340;
        const origW = imageNaturalSizeRef.current?.width || contW;
        const origH = imageNaturalSizeRef.current?.height || contH;

        const t0 = touches[0];
        const t1 = touches[1];

        // Seamless handoff between single-finger drag and two-finger pinch with zero jumps
        if (numTouches !== prevTouchCountRef.current) {
          prevTouchCountRef.current = numTouches;
          if (numTouches === 1 && t0) {
            prevTouchPosRef.current = { x: t0.pageX, y: t0.pageY };
            prevPinchDistRef.current = null;
            prevPinchMidRef.current = null;
          } else if (numTouches >= 2 && t0 && t1) {
            prevPinchDistRef.current = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
            prevPinchMidRef.current = {
              x: (t0.pageX + t1.pageX) / 2,
              y: (t0.pageY + t1.pageY) / 2,
            };
            prevTouchPosRef.current = null;
          }
          return;
        }

        // 1-Finger Smooth Panning
        if (numTouches === 1 && t0 && prevTouchPosRef.current) {
          let dx = t0.pageX - prevTouchPosRef.current.x;
          let dy = t0.pageY - prevTouchPosRef.current.y;
          prevTouchPosRef.current = { x: t0.pageX, y: t0.pageY };

          const currentScale = cropScaleRef.current;
          const bounds = calculatePanBounds(currentScale, contW, contH, origW, origH);

          // Elastic rubber-band resistance when pulling past bounds
          if (cropPanRef.current.x > bounds.maxX && dx > 0) {
            dx *= 0.32;
          } else if (cropPanRef.current.x < bounds.minX && dx < 0) {
            dx *= 0.32;
          }

          if (cropPanRef.current.y > bounds.maxY && dy > 0) {
            dy *= 0.32;
          } else if (cropPanRef.current.y < bounds.minY && dy < 0) {
            dy *= 0.32;
          }

          const nextX = cropPanRef.current.x + dx;
          const nextY = cropPanRef.current.y + dy;
          cropPanRef.current = { x: nextX, y: nextY };
          panAnim.setValue({ x: nextX, y: nextY });
          return;
        }

        // 2-Finger Simultaneous Pinch-to-Zoom & Pan
        if (numTouches >= 2 && t0 && t1 && prevPinchDistRef.current && prevPinchMidRef.current) {
          const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          const midX = (t0.pageX + t1.pageX) / 2;
          const midY = (t0.pageY + t1.pageY) / 2;

          let panDx = midX - prevPinchMidRef.current.x;
          let panDy = midY - prevPinchMidRef.current.y;

          const scaleRatio = prevPinchDistRef.current > 0 ? dist / prevPinchDistRef.current : 1;
          prevPinchDistRef.current = dist;
          prevPinchMidRef.current = { x: midX, y: midY };

          const currentScale = cropScaleRef.current;
          let nextScale = currentScale * scaleRatio;

          // Elastic zoom damping past limits [1.0, 3.5]
          if (nextScale < 1.0) {
            const under = 1.0 - nextScale;
            nextScale = 1.0 - under * 0.35;
            nextScale = Math.max(0.75, nextScale);
          } else if (nextScale > 3.5) {
            const over = nextScale - 3.5;
            nextScale = 3.5 + over * 0.35;
            nextScale = Math.min(4.2, nextScale);
          }

          // Focal shift compensation to keep point under fingers anchored
          const actualRatio = nextScale / (currentScale || 1.0);
          const screenMidX = Dimensions.get('window').width / 2;
          const focalDx = (1 - actualRatio) * (midX - screenMidX - cropPanRef.current.x);

          const bounds = calculatePanBounds(nextScale, contW, contH, origW, origH);
          if (cropPanRef.current.x > bounds.maxX && panDx > 0) panDx *= 0.32;
          if (cropPanRef.current.x < bounds.minX && panDx < 0) panDx *= 0.32;
          if (cropPanRef.current.y > bounds.maxY && panDy > 0) panDy *= 0.32;
          if (cropPanRef.current.y < bounds.minY && panDy < 0) panDy *= 0.32;

          const nextPanX =
            cropPanRef.current.x + panDx + (Math.abs(focalDx) < 25 ? focalDx * 0.5 : 0);
          const nextPanY = cropPanRef.current.y + panDy;

          cropScaleRef.current = nextScale;
          cropPanRef.current = { x: nextPanX, y: nextPanY };

          scaleAnim.setValue(nextScale);
          panAnim.setValue({ x: nextPanX, y: nextPanY });
        }
      },
      onPanResponderRelease: () => {
        setIsInteracting(false);
        prevTouchCountRef.current = 0;
        prevTouchPosRef.current = null;
        prevPinchDistRef.current = null;
        prevPinchMidRef.current = null;

        const contW = viewportSizeRef.current.width || 340;
        const contH = viewportSizeRef.current.height || 340;
        const origW = imageNaturalSizeRef.current?.width || contW;
        const origH = imageNaturalSizeRef.current?.height || contH;

        let targetScale = cropScaleRef.current;
        if (targetScale < 1.0) {
          targetScale = 1.0;
        } else if (targetScale > 3.5) {
          targetScale = 3.5;
        }

        const bounds = calculatePanBounds(targetScale, contW, contH, origW, origH);
        const snappedX = Math.max(bounds.minX, Math.min(bounds.maxX, cropPanRef.current.x));
        const snappedY = Math.max(bounds.minY, Math.min(bounds.maxY, cropPanRef.current.y));

        const needsSnap =
          Math.abs(targetScale - cropScaleRef.current) > 0.005 ||
          Math.abs(snappedX - cropPanRef.current.x) > 0.5 ||
          Math.abs(snappedY - cropPanRef.current.y) > 0.5;

        if (needsSnap) {
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: targetScale,
              tension: 140,
              friction: 14,
              useNativeDriver: true,
            }),
            Animated.spring(panAnim, {
              toValue: { x: snappedX, y: snappedY },
              tension: 140,
              friction: 14,
              useNativeDriver: true,
            }),
          ]).start();
          haptics.impactLight();
        }

        cropScaleRef.current = targetScale;
        cropPanRef.current = { x: snappedX, y: snappedY };
        setCropScale(targetScale);
        setCropTranslate({ x: snappedX, y: snappedY });
      },
      onPanResponderTerminate: () => {
        setIsInteracting(false);
        prevTouchCountRef.current = 0;
        prevTouchPosRef.current = null;
        prevPinchDistRef.current = null;
        prevPinchMidRef.current = null;

        const contW = viewportSizeRef.current.width || 340;
        const contH = viewportSizeRef.current.height || 340;
        const origW = imageNaturalSizeRef.current?.width || contW;
        const origH = imageNaturalSizeRef.current?.height || contH;

        const targetScale = Math.max(1.0, Math.min(3.5, cropScaleRef.current));
        const bounds = calculatePanBounds(targetScale, contW, contH, origW, origH);
        const snappedX = Math.max(bounds.minX, Math.min(bounds.maxX, cropPanRef.current.x));
        const snappedY = Math.max(bounds.minY, Math.min(bounds.maxY, cropPanRef.current.y));

        cropScaleRef.current = targetScale;
        cropPanRef.current = { x: snappedX, y: snappedY };
        setCropScale(targetScale);
        setCropTranslate({ x: snappedX, y: snappedY });
      },
    })
  ).current;

  const handleZoomIn = () => {
    haptics.impactLight();
    const contW = viewportSizeRef.current.width || 340;
    const contH = viewportSizeRef.current.height || 340;
    const origW = imageNaturalSizeRef.current?.width || contW;
    const origH = imageNaturalSizeRef.current?.height || contH;

    const nextScale = Math.min(3.5, Math.round((cropScaleRef.current + 0.25) * 100) / 100);
    const bounds = calculatePanBounds(nextScale, contW, contH, origW, origH);
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, cropPanRef.current.x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, cropPanRef.current.y));

    cropScaleRef.current = nextScale;
    cropPanRef.current = { x: clampedX, y: clampedY };

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: nextScale,
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.spring(panAnim, {
        toValue: { x: clampedX, y: clampedY },
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();

    setCropScale(nextScale);
    setCropTranslate({ x: clampedX, y: clampedY });
  };

  const handleZoomOut = () => {
    haptics.impactLight();
    const contW = viewportSizeRef.current.width || 340;
    const contH = viewportSizeRef.current.height || 340;
    const origW = imageNaturalSizeRef.current?.width || contW;
    const origH = imageNaturalSizeRef.current?.height || contH;

    const nextScale = Math.max(1.0, Math.round((cropScaleRef.current - 0.25) * 100) / 100);
    const bounds = calculatePanBounds(nextScale, contW, contH, origW, origH);
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, cropPanRef.current.x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, cropPanRef.current.y));

    cropScaleRef.current = nextScale;
    cropPanRef.current = { x: clampedX, y: clampedY };

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: nextScale,
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.spring(panAnim, {
        toValue: { x: clampedX, y: clampedY },
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();

    setCropScale(nextScale);
    setCropTranslate({ x: clampedX, y: clampedY });
  };

  const handleResetCrop = () => {
    haptics.selection();
    cropScaleRef.current = 1.0;
    cropPanRef.current = { x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.0,
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.spring(panAnim, {
        toValue: { x: 0, y: 0 },
        tension: 130,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();
    setCropScale(1.0);
    setCropTranslate({ x: 0, y: 0 });
  };

  const handleToggleGrid = () => {
    haptics.selection();
    setShowGrid((prev) => !prev);
  };

  // Load existing media from backend on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const mediaList = await profileApi.getMediaList();
        if (isMounted && mediaList && mediaList.length > 0) {
          setDraftPhotos(
            mediaList.map((m) => ({
              id: m.id,
              url: m.url,
              isPrimary: m.isPrimary,
              status: m.status,
            }))
          );
        }
      } catch {
        // Fallback: keep existing draft photos in store
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const readyPhotos = draftPhotos.filter((p) => p.status === 'READY');
  const coverPhoto = readyPhotos.find((p) => p.isPrimary) || readyPhotos[0];
  const secondaryPhotos = readyPhotos.filter((p) => p.id !== coverPhoto?.id);
  const filledCount = readyPhotos.length;
  const isMinimumMet = filledCount >= 2;

  // Viewport-adaptive base dimensions preserving exact natural portrait aspect ratio
  const studioBaseImageSize = (() => {
    const contW = viewportSize.width || 340;
    const contH = viewportSize.height || 340;
    const origW = imageNaturalSize?.width || contW;
    const origH = imageNaturalSize?.height || contH;
    const scaleRatio = Math.max(contW / origW, contH / origH);
    return {
      width: Math.round(origW * scaleRatio),
      height: Math.round(origH * scaleRatio),
    };
  })();

  // Helper to render active photo filter overlay
  const renderFilterOverlay = (filterId?: string) => {
    if (!filterId || filterId === 'original') return null;
    const filter = PHOTO_FILTERS.find((f) => f.id === filterId);
    if (!filter) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {filter.gradientColors && (
          <LinearGradient
            colors={filter.gradientColors as unknown as [string, string, ...string[]]}
            locations={filter.locations as unknown as [number, number, ...number[]]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {filter.vignette && (
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.22)', 'rgba(0, 0, 0, 0.0)', 'rgba(0, 0, 0, 0.28)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
    );
  };

  // Open the add modal for a specific slot
  const handleOpenSlot = (slotIndex: number) => {
    haptics.impactLight();
    setActiveSlotIndex(slotIndex);
    setIsPickerModalVisible(true);
  };

  // Launch device photo gallery / storage
  const handlePickFromGallery = async () => {
    haptics.selection();
    setErrorMessage(undefined);

    // If bottom sheet is open, close it and wait for native dismissal animation (350ms)
    // This is required on iOS so UIKit does not reject presenting PHPickerViewController
    if (isPickerModalVisible) {
      setIsPickerModalVisible(false);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    try {
      // Modern PHPicker on iOS 14+ does not require invasive permission prompts.
      // On older systems or Android, check permission gracefully.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => null);
      if (perm && perm.status !== 'granted' && !perm.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access in your device settings to select profile photos.',
          [{ text: 'OK' }]
        );
        setErrorMessage(
          'Photo library access is required to choose photos. Please enable permissions in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Prevents legacy UIImagePickerController 1:1 square crop lockups on iOS; our in-app Portrait Studio handles 4:5 preview and filter cropping cleanly!
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setEditingPhotoId(null);
        setPendingPhotoUri(result.assets[0].uri);
        setSelectedFilterId('original');
        setIsStudioModalVisible(true);
      }
    } catch (err: any) {
      console.warn('[Photos] Error in handlePickFromGallery:', err);
      setErrorMessage(err?.message || 'Failed to select photo from gallery.');
    }
  };

  // Launch in-app native camera capture
  const handleCaptureFromCamera = async () => {
    haptics.selection();
    setErrorMessage(undefined);

    // If bottom sheet is open, close it and wait for native dismissal animation (350ms)
    if (isPickerModalVisible) {
      setIsPickerModalVisible(false);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Simulator Detection:
    // iOS and Android simulators do not have camera hardware. Attempting to launch
    // UIImagePickerController with .camera crashes or hangs UIKit on simulators.
    if (!Device.isDevice) {
      Alert.alert(
        'Simulator Camera Unavailable',
        'Camera capture is not supported on device simulators. Opening your photo library instead so you can test the photo studio.',
        [{ text: 'Open Library', onPress: () => void handlePickFromGallery() }]
      );
      setErrorMessage(
        'Camera is not available on simulators. Launching device photo library instead...'
      );
      return handlePickFromGallery();
    }

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
      if (perm && perm.status !== 'granted' && !perm.granted) {
        Alert.alert(
          'Camera Access Required',
          'Please enable camera access in your device settings to take your profile portrait.',
          [{ text: 'OK' }]
        );
        setErrorMessage(
          'Camera access is required to capture your portrait. Please enable permissions in your device settings.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.front,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setEditingPhotoId(null);
        setPendingPhotoUri(result.assets[0].uri);
        setSelectedFilterId('original');
        setIsStudioModalVisible(true);
      }
    } catch (err: any) {
      console.warn('[Photos] Error in handleCaptureFromCamera:', err);
      Alert.alert(
        'Camera Error',
        'Could not open the camera on this device. Would you like to select a photo from your gallery instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Gallery', onPress: () => void handlePickFromGallery() },
        ]
      );
      setErrorMessage(
        'Camera could not be opened. You can select a photo from your gallery instead.'
      );
    }
  };

  // Open real filter studio for an existing uploaded photo
  const handleOpenFilterForPhoto = (photo: (typeof draftPhotos)[0], slotIndex?: number) => {
    haptics.selection();
    if (typeof slotIndex === 'number') {
      setActiveSlotIndex(slotIndex);
    }
    setEditingPhotoId(photo.id);
    setPendingPhotoUri(photo.url);
    setSelectedFilterId(photo.filterId || 'original');
    setIsStudioModalVisible(true);
  };

  // Confirm photo and apply chosen filter in Portrait Studio
  const handleConfirmStudioPhoto = async () => {
    if (!pendingPhotoUri) return;

    let finalPhotoUri = pendingPhotoUri;

    // Execute physical crop and resize if user modified framing or scale
    const isTransformed =
      cropScaleRef.current > 1.02 ||
      Math.abs(cropPanRef.current.x) > 2 ||
      Math.abs(cropPanRef.current.y) > 2;

    if (isTransformed) {
      try {
        const origW = imageNaturalSizeRef.current?.width || imageNaturalSize?.width || 1080;
        const origH = imageNaturalSizeRef.current?.height || imageNaturalSize?.height || 1350;
        const contW = viewportSizeRef.current.width || viewportSize.width || 340;
        const contH = viewportSizeRef.current.height || viewportSize.height || 340;

        const scaleRatio = Math.max(contW / origW, contH / origH);
        const effectiveW = origW * scaleRatio * cropScaleRef.current;
        const effectiveH = origH * scaleRatio * cropScaleRef.current;
        const leftInRendered = (effectiveW - contW) / 2 - cropPanRef.current.x;
        const topInRendered = (effectiveH - contH) / 2 - cropPanRef.current.y;
        const divisor = scaleRatio * cropScaleRef.current;

        let cropX = Math.round(leftInRendered / divisor);
        let cropY = Math.round(topInRendered / divisor);
        let cropW = Math.round(contW / divisor);
        let cropH = Math.round(contH / divisor);

        cropX = Math.max(0, Math.min(origW - 10, cropX));
        cropY = Math.max(0, Math.min(origH - 10, cropY));
        cropW = Math.max(10, Math.min(origW - cropX, cropW));
        cropH = Math.max(10, Math.min(origH - cropY, cropH));

        const manipResult = await manipulateAsync(
          pendingPhotoUri,
          [
            {
              crop: {
                originX: cropX,
                originY: cropY,
                width: cropW,
                height: cropH,
              },
            },
            {
              resize: {
                width: 1080,
              },
            },
          ],
          { compress: 0.9, format: SaveFormat.JPEG }
        );

        if (manipResult?.uri) {
          finalPhotoUri = manipResult.uri;
        }
      } catch (cropErr) {
        console.warn('[Photos] Crop execution error, using original photo:', cropErr);
      }
    }

    // If editing existing photo's filter (and optional new crop)
    if (editingPhotoId) {
      if (finalPhotoUri !== pendingPhotoUri) {
        setDraftPhotos(
          draftPhotos.map((p) =>
            p.id === editingPhotoId ? { ...p, url: finalPhotoUri, filterId: selectedFilterId } : p
          )
        );
      } else {
        updateDraftPhotoFilter(editingPhotoId, selectedFilterId);
      }
      haptics.notificationSuccess();
      setIsStudioModalVisible(false);
      setEditingPhotoId(null);
      setPendingPhotoUri(null);
      return;
    }

    const existingCoverPhoto =
      activeSlotIndex === 0 ? draftPhotos.find((p) => p.isPrimary) || draftPhotos[0] : undefined;
    const isReplacingCover = activeSlotIndex === 0 && Boolean(existingCoverPhoto);
    const existingCoverId = isReplacingCover ? existingCoverPhoto?.id : null;

    const photoToReplaceId = replacingPhotoId || existingCoverId;
    const isReplacing = Boolean(photoToReplaceId);

    if (!isReplacing && draftPhotos.length >= 6) {
      setIsStudioModalVisible(false);
      return;
    }

    setIsStudioModalVisible(false);
    setIsUploading(true);
    setErrorMessage(undefined);

    const isFirst = draftPhotos.length === 0 || activeSlotIndex === 0;

    try {
      if (photoToReplaceId) {
        try {
          await profileApi.deleteMedia(photoToReplaceId);
        } catch {
          // Best-effort remote deletion
        }
      }

      const uploadPayload = {
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 512,
      };

      const uploadInfo = await profileApi.requestUploadUrl(uploadPayload);
      const completedItem: MediaItemResponse = await profileApi.completeUpload(uploadInfo.mediaId);

      const newPhotoItem = {
        id: completedItem.id,
        url: finalPhotoUri,
        isPrimary: isFirst,
        status: 'READY' as const,
        filterId: selectedFilterId,
      };

      if (photoToReplaceId) {
        setDraftPhotos(draftPhotos.map((p) => (p.id === photoToReplaceId ? newPhotoItem : p)));
      } else {
        addDraftPhoto(newPhotoItem);
      }
      if (activeSlotIndex === 0) {
        setPrimaryDraftPhoto(completedItem.id);
      }
      haptics.notificationSuccess();

      trackOnboardingEvent('photo_added', {
        photoCount: isReplacing ? draftPhotos.length : draftPhotos.length + 1,
        isPrimary: isFirst,
        filterId: selectedFilterId,
      });
    } catch {
      // Offline fallback: keep flow functional in sandbox
      const fallbackId = `local_photo_${Date.now()}`;

      const fallbackPhotoItem = {
        id: fallbackId,
        url: finalPhotoUri,
        isPrimary: isFirst,
        status: 'READY' as const,
        filterId: selectedFilterId,
      };

      if (photoToReplaceId) {
        setDraftPhotos(draftPhotos.map((p) => (p.id === photoToReplaceId ? fallbackPhotoItem : p)));
      } else {
        addDraftPhoto(fallbackPhotoItem);
      }
      if (activeSlotIndex === 0) {
        setPrimaryDraftPhoto(fallbackId);
      }
      haptics.notificationSuccess();

      trackOnboardingEvent('photo_added', {
        photoCount: isReplacing ? draftPhotos.length : draftPhotos.length + 1,
        isPrimary: isFirst,
        filterId: selectedFilterId,
      });
    } finally {
      setIsUploading(false);
      setPendingPhotoUri(null);
      setEditingPhotoId(null);
      setReplacingPhotoId(null);
      setActiveSlotIndex(0);
    }
  };

  const handleRetakeFromStudio = () => {
    haptics.selection();
    const currentPhotoId = editingPhotoId;
    setReplacingPhotoId(currentPhotoId);
    setIsStudioModalVisible(false);
    setPendingPhotoUri(null);
    setEditingPhotoId(null);

    // Wait for studio modal exit animation (220ms) and iOS view controller dismissal
    // before opening the picker modal to avoid modal presentation collisions on iOS.
    setTimeout(() => {
      setIsPickerModalVisible(true);
    }, 320);
  };

  const handleDeletePhoto = async (photoId: string) => {
    haptics.impactLight();
    try {
      await profileApi.deleteMedia(photoId);
    } catch {
      // Best-effort remote deletion
    }
    removeDraftPhoto(photoId);
    trackOnboardingEvent('photo_deleted', {
      remainingCount: draftPhotos.length - 1,
    });
  };

  const handleNext = () => {
    if (!isMinimumMet) {
      haptics.notificationError();
      setErrorMessage('Please upload at least 2 photos before continuing to the next stage.');
      return;
    }

    haptics.impactMedium();
    setErrorMessage(undefined);
    trackOnboardingEvent('photos_completed', { photoCount: filledCount });
    router.push('/(onboarding)/interests');
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/profile-setup');
    }
  };

  const renderSecondaryCard = (
    slotConfig: SlotConfig,
    photo: (typeof draftPhotos)[0] | undefined,
    size: 'medium' | 'compact'
  ) => {
    const isMedium = size === 'medium';
    const cardStyle = isMedium ? styles.secondaryCardMedium : styles.secondaryCardCompact;

    if (photo) {
      return (
        <TouchableOpacity
          key={photo.id}
          onPress={() => handleOpenFilterForPhoto(photo, slotConfig.index)}
          activeOpacity={0.88}
          style={[
            cardStyle,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              backgroundColor: isDark ? '#141418' : '#FFFFFF',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Photo ${slotConfig.index + 1}: ${slotConfig.prompt}. Tap to adjust filter and cropping.`}
        >
          <Image source={{ uri: photo.url }} style={styles.photoImage} resizeMode="cover" />
          {renderFilterOverlay(photo.filterId)}

          {/* Top Overlay with Index Badge & Delete Button */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.65)', 'rgba(0, 0, 0, 0.0)']}
            style={styles.cardTopGradient}
          >
            <View style={styles.slotIndexBadge}>
              <Text style={styles.slotIndexText}>0{slotConfig.index + 1}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => handleOpenFilterForPhoto(photo, slotConfig.index)}
                style={styles.filterIconButton}
                accessibilityRole="button"
                accessibilityLabel={`Adjust filter for photo ${slotConfig.index + 1}`}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <SlidersHorizontal size={11} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDeletePhoto(photo.id)}
                style={styles.deleteIconButton}
                accessibilityRole="button"
                accessibilityLabel={`Delete photo ${slotConfig.index + 1}`}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={11} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Bottom Vignette with Context */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.0)', 'rgba(0, 0, 0, 0.78)']}
            style={styles.cardBottomGradient}
          >
            <Text style={styles.cardPromptText} numberOfLines={1}>
              {slotConfig.prompt}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    // Empty Slot Card
    return (
      <TouchableOpacity
        key={`empty-slot-${slotConfig.index}`}
        onPress={() => handleOpenSlot(slotConfig.index)}
        activeOpacity={0.78}
        style={[
          cardStyle,
          styles.emptyCard,
          {
            backgroundColor: isDark ? '#121216' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Slot ${slotConfig.index + 1}: ${slotConfig.prompt}. Tap to add photo.`}
      >
        <View style={styles.emptySlotTop}>
          <View style={styles.emptyNumberBadge}>
            <Text style={styles.emptyNumberText}>0{slotConfig.index + 1}</Text>
          </View>
        </View>

        <View style={styles.emptySlotCenter}>
          <View
            style={[
              isMedium ? styles.plusCircleMedium : styles.plusCircle,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <Plus size={isMedium ? 18 : 15} color={theme.colors.textPrimary} strokeWidth={2.2} />
          </View>
        </View>

        <View style={styles.emptySlotBottom}>
          <Text
            style={[styles.emptyPromptLabel, { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {slotConfig.prompt}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Glossy Frosted Top Vignette */}
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
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 0.90)',
                  'rgba(11, 11, 14, 0.65)',
                  'rgba(11, 11, 14, 0.20)',
                  'rgba(11, 11, 14, 0.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 0.90)',
                  'rgba(250, 250, 250, 0.65)',
                  'rgba(250, 250, 250, 0.20)',
                  'rgba(250, 250, 250, 0.0)',
                ]
          }
          locations={[0, 0.4, 0.68, 0.88, 1.0]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255, 255, 255, 0.06)',
                  'rgba(255, 255, 255, 0.02)',
                  'rgba(255, 255, 255, 0.0)',
                ]
              : [
                  'rgba(255, 255, 255, 0.60)',
                  'rgba(255, 255, 255, 0.20)',
                  'rgba(255, 255, 255, 0.0)',
                ]
          }
          locations={[0, 0.45, 1.0]}
          style={styles.glossySheenLayer}
        />
      </Animated.View>

      {/* Floating Encircled Back Button */}
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
        <ArrowLeft size={19} color={theme.colors.textPrimary} strokeWidth={2.2} />
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth || 520,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 64, 76),
            paddingBottom: Math.max(insets.bottom + 115, 135),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ======================================================== */}
        {/* Hero Section: Relaxed, Airy & Monochromatic             */}
        {/* ======================================================== */}
        <View style={styles.heroSection}>
          <View style={styles.heroTitleRow}>
            <Heading
              level="h1"
              style={[
                styles.heroTitle,
                { fontFamily: folkraFont, color: theme.colors.textPrimary },
              ]}
            >
              Add your photos
            </Heading>

            {/* Pure Typographic 02 / 06 Indicator */}
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                02
              </Text>
              <Text
                style={[
                  styles.stepDividerText,
                  { color: theme.colors.textTertiary, fontFamily: folkraFont },
                ]}
              >
                /
              </Text>
              <Text
                style={[
                  styles.stepTotalText,
                  { color: theme.colors.textTertiary, fontFamily: folkraFont },
                ]}
              >
                06
              </Text>
            </View>
          </View>

          <Text level="body" color="secondary" style={styles.heroSubtitle}>
            Choose photos that reflect your authentic everyday life. Your main portrait is the first
            thing people discover.
          </Text>

          {/* Minimalist, Elegant Story-Style Progress Dash Bar */}
          <View style={styles.storyProgressRow}>
            <View style={styles.dashTrack}>
              {Array.from({ length: 6 }).map((_, i) => {
                const isFilled = i < filledCount;
                return (
                  <View
                    key={`dash-${i}`}
                    style={[
                      styles.dashSegment,
                      {
                        backgroundColor: isFilled
                          ? isDark
                            ? '#FFFFFF'
                            : '#111114'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.14)'
                            : '#E4E4E7',
                      },
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.progressTextGroup}>
              <Text
                level="caption"
                style={{ color: theme.colors.textSecondary, fontWeight: '600' }}
              >
                {filledCount} of 6 added
              </Text>
              <Text
                level="caption"
                style={{
                  color: isMinimumMet
                    ? isDark
                      ? '#FFFFFF'
                      : '#111114'
                    : theme.colors.textTertiary,
                  fontWeight: isMinimumMet ? '700' : '600',
                  marginLeft: 6,
                }}
              >
                {isMinimumMet ? '• Ready' : '• 2 required'}
              </Text>
            </View>
          </View>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: '#EF4444',
              },
            ]}
          >
            <AlertCircle size={15} color="#EF4444" style={{ marginRight: 8 }} />
            <Text
              level="bodySmall"
              style={{ color: '#EF4444', fontWeight: '600', flex: 1, lineHeight: 18 }}
            >
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Uploading Spinner Notice */}
        {isUploading && (
          <View
            style={[
              styles.uploadingNotice,
              {
                backgroundColor: isDark ? '#141418' : '#F4F4F6',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            <Text
              level="bodySmall"
              style={{ color: theme.colors.textPrimary, fontWeight: '600', marginLeft: 8 }}
            >
              Adding photo to your gallery...
            </Text>
          </View>
        )}

        {/* ======================================================== */}
        {/* Hero Section: Big Cover Photo Box                        */}
        {/* ======================================================== */}
        <View style={styles.coverBoxContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeaderTitle,
                { color: theme.colors.textSecondary, fontFamily: folkraFont },
              ]}
            >
              COVER PHOTO
            </Text>
            <Text
              style={[
                styles.requiredBadgeText,
                {
                  color: coverPhoto ? (isDark ? '#FFFFFF' : '#111114') : theme.colors.textTertiary,
                  fontWeight: coverPhoto ? '700' : '500',
                },
              ]}
            >
              {coverPhoto ? 'Primary Ready' : 'Required · 01'}
            </Text>
          </View>

          {coverPhoto ? (
            <TouchableOpacity
              onPress={() => handleOpenSlot(0)}
              activeOpacity={0.92}
              style={[
                styles.bigCoverCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#111114',
                  backgroundColor: isDark ? '#141418' : '#F4F4F6',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cover Photo. Tap to change."
            >
              <Image
                source={{ uri: coverPhoto.url }}
                style={styles.bigCoverImage}
                resizeMode="cover"
              />
              {renderFilterOverlay(coverPhoto.filterId)}

              {/* Specular Edge Highlight Layer */}
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.0)']}
                style={styles.bigCoverSheen}
                pointerEvents="none"
              />

              {/* Viewfinder Corner Framing Reticles (Subtle Camera Outline) */}
              <View
                style={[
                  styles.reticleTopLeft,
                  { borderColor: 'rgba(255, 255, 255, 0.45)', opacity: 0.7 },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.reticleTopRight,
                  { borderColor: 'rgba(255, 255, 255, 0.45)', opacity: 0.7 },
                ]}
                pointerEvents="none"
              />
              {/* Top Bar with Star Badge and Encircled Delete Button */}
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.68)', 'rgba(0, 0, 0, 0.0)']}
                style={styles.bigCoverTopGradient}
              >
                <View style={styles.bigCoverBadgePill}>
                  <Camera size={11} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.bigCoverBadgeText}>Cover</Text>
                  {coverPhoto.filterId && coverPhoto.filterId !== 'original' && (
                    <View style={styles.inlineFilterDot} />
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handleDeletePhoto(coverPhoto.id)}
                  style={styles.bigCoverDeleteButton}
                  accessibilityRole="button"
                  accessibilityLabel="Delete cover photo"
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={12} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </LinearGradient>

              {/* Velvety Deep Dark Multi-Stop Scrim (100% Soft Faded at Top, Zero Edges or Lines) */}
              <LinearGradient
                colors={[
                  'rgba(8, 8, 12, 0.0)',
                  'rgba(8, 8, 12, 0.04)',
                  'rgba(8, 8, 12, 0.14)',
                  'rgba(8, 8, 12, 0.32)',
                  'rgba(8, 8, 12, 0.58)',
                  'rgba(8, 8, 12, 0.82)',
                  'rgba(8, 8, 12, 0.94)',
                  'rgba(8, 8, 12, 0.98)',
                  'rgba(8, 8, 12, 1.0)',
                ]}
                locations={[0, 0.12, 0.25, 0.4, 0.56, 0.72, 0.84, 0.94, 1.0]}
                style={styles.bigCoverBottomGradient}
                pointerEvents="none"
              />

              {/* Overlaid Editorial Content & Frosted Glass Action Pills */}
              <View style={styles.bigCoverBottomContentRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.bigCoverTitleText}>Main Portrait</Text>
                  <Text style={styles.bigCoverSubtitleText} numberOfLines={1}>
                    {coverPhoto.filterId && coverPhoto.filterId !== 'original'
                      ? `Filter: ${PHOTO_FILTERS.find((f) => f.id === coverPhoto.filterId)?.name || 'Custom'}`
                      : '4:5 Editorial Profile'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleOpenFilterForPhoto(coverPhoto, 0)}
                    style={styles.bigCoverFilterPill}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Adjust cover photo filters"
                  >
                    <BlurView
                      intensity={45}
                      tint="light"
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <SlidersHorizontal size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.bigCoverChangeText}>Filters</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenSlot(0)}
                    style={styles.bigCoverChangePill}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Change cover photo"
                  >
                    <BlurView
                      intensity={45}
                      tint="light"
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <RotateCw size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.bigCoverChangeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.bigCoverCard,
                styles.viewfinderCard,
                {
                  backgroundColor: isDark ? '#121216' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
                },
              ]}
            >
              {/* Viewfinder 4-Corner Curved Framing Reticles */}
              <View
                style={[
                  styles.reticleTopLeft,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.22)' },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.reticleTopRight,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.22)' },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.reticleBottomLeft,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.22)' },
                ]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.reticleBottomRight,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.22)' },
                ]}
                pointerEvents="none"
              />

              {/* Top HUD Telemetry Bar with Live Pulsing Dot */}
              <View style={styles.viewfinderTopHud} pointerEvents="none">
                <View style={styles.liveIndicatorRow}>
                  <Animated.View
                    style={[
                      styles.liveDotHalo,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.22)'
                          : 'rgba(0, 0, 0, 0.16)',
                        opacity: studioDotOpacity,
                        transform: [{ scale: studioPulseScale }],
                      },
                    ]}
                  >
                    <View style={styles.liveDot} />
                  </Animated.View>
                  <Text
                    style={[
                      styles.viewfinderHudText,
                      { color: theme.colors.textSecondary, fontFamily: folkraFont },
                    ]}
                  >
                    PORTRAIT FRAME 4:5
                  </Text>
                </View>

                <Text
                  style={[
                    styles.viewfinderHudText,
                    { color: theme.colors.textTertiary, letterSpacing: 1.0 },
                  ]}
                >
                  COVER · 01
                </Text>
              </View>

              {/* Center Concentric Optical Lens with Breathing Halo */}
              <TouchableOpacity
                onPress={() => handleOpenSlot(0)}
                activeOpacity={0.88}
                style={styles.opticalCenterTapZone}
                accessibilityRole="button"
                accessibilityLabel="Choose Cover Photo"
              >
                <View
                  style={[
                    styles.opticalOuterRing,
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  {/* Dynamic Breathing Ambient Halo */}
                  <Animated.View
                    style={[
                      styles.breathingHalo,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(0, 0, 0, 0.06)',
                        opacity: studioPulseOpacity,
                        transform: [{ scale: studioPulseScale }],
                      },
                    ]}
                  />

                  {/* Core Lens Ring */}
                  <View
                    style={[
                      styles.centerLens,
                      {
                        backgroundColor: isDark ? '#17171E' : '#F5F5F7',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)',
                      },
                    ]}
                  >
                    <Camera size={23} color={theme.colors.textPrimary} strokeWidth={1.8} />
                    <View
                      style={[
                        styles.lensMiniPlus,
                        {
                          backgroundColor: theme.colors.textPrimary,
                          borderColor: isDark ? '#17171E' : '#FFFFFF',
                        },
                      ]}
                    >
                      <Plus size={8} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                    </View>
                  </View>
                </View>

                <Text
                  style={[
                    styles.viewfinderHeadline,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  Frame Your First Impression
                </Text>

                <Text level="caption" color="tertiary" style={styles.viewfinderSubtitle}>
                  High-resolution 4:5 portrait shown first on Nazar
                </Text>
              </TouchableOpacity>

              {/* Bottom Tactile Dual Studio Actions: Direct 1-Tap Trigger */}
              <View style={styles.studioButtonsRow}>
                <TouchableOpacity
                  onPress={handleCaptureFromCamera}
                  style={[
                    styles.studioActionButton,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)',
                    },
                  ]}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="Take live portrait with camera"
                >
                  <Camera
                    size={13.5}
                    color={theme.colors.textPrimary}
                    strokeWidth={2}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.studioActionText, { color: theme.colors.textPrimary }]}>
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  style={[
                    styles.studioActionButton,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)',
                    },
                  ]}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from photo library"
                >
                  <ImagePlus
                    size={13.5}
                    color={theme.colors.textPrimary}
                    strokeWidth={2}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.studioActionText, { color: theme.colors.textPrimary }]}>
                    Photo Library
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* Secondary Supporting Photos Grid                         */}
        {/* ======================================================== */}
        <View style={styles.secondarySection}>
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeaderTitle,
                { color: theme.colors.textSecondary, fontFamily: folkraFont },
              ]}
            >
              ADDITIONAL PERSPECTIVES
            </Text>
            <Text level="caption" color="tertiary">
              Add at least 1 more
            </Text>
          </View>

          {/* Row 1: 2 Medium Cards (Full Length & Candid Smile) */}
          <View style={styles.secondaryRowMedium}>
            {SECONDARY_SLOTS.slice(0, 2).map((slotConfig, idx) => {
              const photo = secondaryPhotos[idx];
              return renderSecondaryCard(slotConfig, photo, 'medium');
            })}
          </View>

          {/* Row 2: 3 Compact Cards (Passion, Travel, Casual) */}
          <View style={styles.secondaryRowCompact}>
            {SECONDARY_SLOTS.slice(2, 5).map((slotConfig, idx) => {
              const photo = secondaryPhotos[idx + 2];
              return renderSecondaryCard(slotConfig, photo, 'compact');
            })}
          </View>
        </View>

        {/* ======================================================== */}
        {/* Friendly Photo Inspiration & Ideas (Non-Strict, Relaxed) */}
        {/* ======================================================== */}
        <View style={styles.inspirationSection}>
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeaderTitle,
                { color: theme.colors.textSecondary, fontFamily: folkraFont },
              ]}
            >
              PHOTO INSPIRATION
            </Text>
            <Text level="caption" color="tertiary">
              Ideas that spark connection
            </Text>
          </View>

          <View style={styles.inspirationCardList}>
            <View
              style={[
                styles.inspirationItem,
                {
                  backgroundColor: isDark ? '#121216' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                },
              ]}
            >
              <View
                style={[
                  styles.inspirationIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}
              >
                <UserCheck size={16} color={theme.colors.textPrimary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text level="bodySmall" style={styles.inspirationTitle}>
                  Solo Cover Portrait
                </Text>
                <Text level="caption" color="secondary" style={styles.inspirationDesc}>
                  A warm, clear portrait where your eyes and smile are easily seen.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.inspirationItem,
                {
                  backgroundColor: isDark ? '#121216' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                },
              ]}
            >
              <View
                style={[
                  styles.inspirationIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}
              >
                <Sun size={16} color={theme.colors.textPrimary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text level="bodySmall" style={styles.inspirationTitle}>
                  Soft Natural Light
                </Text>
                <Text level="caption" color="secondary" style={styles.inspirationDesc}>
                  Daylight or cozy cafe lighting creates natural warmth and depth.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.inspirationItem,
                {
                  backgroundColor: isDark ? '#121216' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                },
              ]}
            >
              <View
                style={[
                  styles.inspirationIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}
              >
                <Compass size={16} color={theme.colors.textPrimary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text level="bodySmall" style={styles.inspirationTitle}>
                  Candid Moments
                </Text>
                <Text level="caption" color="secondary" style={styles.inspirationDesc}>
                  Snapshots of you cooking, traveling, exploring hobbies, or sharing a laugh.
                </Text>
              </View>
            </View>
          </View>

          {/* Reassurance Footnote */}
          <View style={styles.reassuranceRow}>
            <ShieldCheck size={13.5} color={theme.colors.textTertiary} />
            <Text level="caption" color="tertiary" style={styles.reassuranceText}>
              Your photos are encrypted and reviewed by Nazar moderation to keep our community safe.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ======================================================== */}
      {/* Floating Bottom Action Dock with 8-Stop Feather Fade     */}
      {/* ======================================================== */}
      <View style={styles.bottomDock} pointerEvents="box-none">
        {/* Soft, Natural Feathered Fade Above the Button */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.0)',
                  'rgba(11, 11, 14, 0.05)',
                  'rgba(11, 11, 14, 0.16)',
                  'rgba(11, 11, 14, 0.38)',
                  'rgba(11, 11, 14, 0.68)',
                  'rgba(11, 11, 14, 0.90)',
                  'rgba(11, 11, 14, 1.0)',
                  'rgba(11, 11, 14, 1.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.0)',
                  'rgba(250, 250, 250, 0.05)',
                  'rgba(250, 250, 250, 0.16)',
                  'rgba(250, 250, 250, 0.38)',
                  'rgba(250, 250, 250, 0.68)',
                  'rgba(250, 250, 250, 0.90)',
                  'rgba(250, 250, 250, 1.0)',
                  'rgba(250, 250, 250, 1.0)',
                ]
          }
          locations={[0, 0.04, 0.1, 0.16, 0.22, 0.3, 0.38, 1.0]}
          style={styles.dockGradientBackdrop}
          pointerEvents="none"
        />

        <View
          style={[
            styles.dockInner,
            {
              maxWidth: maxContentWidth || 520,
              paddingBottom: Math.max(insets.bottom + 14, 20),
            },
          ]}
        >
          {/* Professional CTA Button (Matching The Basics Continue to Photos button) */}
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isMinimumMet || isUploading}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: isDark ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.28 : 0.12,
                opacity: isUploading ? 0.75 : isMinimumMet ? 1 : 0.6,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isMinimumMet
                ? 'Continue to Interests'
                : `Add at least 2 photos (${filledCount} of 2 required)`
            }
            testID="submit-button"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: '#000000',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  {isMinimumMet
                    ? 'Continue to Interests'
                    : `Add At Least 2 Photos (${filledCount}/2)`}
                </Text>
                {isMinimumMet && <ArrowRight size={17} color="#000000" style={{ marginLeft: 8 }} />}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================== */}
      {/* Interactive Photo Selection Bottom Sheet Modal           */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* Interactive Photo Selection Bottom Sheet Modal           */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isPickerModalVisible}
        onClose={() => {
          setIsPickerModalVisible(false);
          setReplacingPhotoId(null);
        }}
        showHandle={true}
      >
        {/* Modal Header */}
        <View style={styles.pickerHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.pickerEyebrowRow}>
              <View
                style={[
                  styles.pickerSlotDot,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' },
                ]}
              />
              <Text
                style={[
                  styles.pickerEyebrowText,
                  { color: isDark ? 'rgba(255, 255, 255, 0.50)' : 'rgba(0, 0, 0, 0.50)' },
                ]}
              >
                SLOT 0{activeSlotIndex + 1} ·{' '}
                {PHOTO_SLOTS[activeSlotIndex]?.prompt?.toUpperCase() || 'SUPPORTING'}
              </Text>
            </View>

            <Text
              style={[
                styles.pickerTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              {activeSlotIndex === 0 ? 'Choose Cover Portrait' : 'Add Supporting Photo'}
            </Text>
            <Text level="caption" color="secondary" style={styles.pickerSubtitle}>
              Select a high-resolution portrait or capture a live shot
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setIsPickerModalVisible(false)}
            style={[
              styles.pickerCloseButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close photo picker"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={15} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Modern Studio Dual Action Tiles (Side-by-Side 50/50 Grid) */}
        <View style={styles.studioDualTilesRow}>
          {/* Tile 1: Photo Library */}
          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[
              styles.studioDualTile,
              {
                backgroundColor: isDark ? '#15151B' : '#F7F7FA',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Choose from photo library"
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255, 255, 255, 0.09)', 'rgba(255, 255, 255, 0.0)']
                  : ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.0)']
              }
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Top Row: Icon Disc on left, Action Arrow on right */}
            <View style={styles.tileTopRow}>
              <View
                style={[
                  styles.tileIconDisc,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <ImagePlus size={21} color={theme.colors.textPrimary} strokeWidth={2} />
              </View>

              <View
                style={[
                  styles.tileCornerPill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <ArrowRight size={12} color={theme.colors.textSecondary} strokeWidth={2} />
              </View>
            </View>

            {/* Bottom Content Block: Left-Aligned Editorial Typography */}
            <View style={styles.tileBottomBlock}>
              <Text
                style={[
                  styles.tileTitleText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                Photo Library
              </Text>
              <Text level="caption" color="secondary" style={styles.tileSubtitleText}>
                Device albums
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tile 2: Live Camera */}
          <TouchableOpacity
            onPress={handleCaptureFromCamera}
            style={[
              styles.studioDualTile,
              {
                backgroundColor: isDark ? '#15151B' : '#F7F7FA',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Capture photo with camera"
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255, 255, 255, 0.09)', 'rgba(255, 255, 255, 0.0)']
                  : ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.0)']
              }
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Top Row: Camera Shutter Disc on left, LIVE Badge on right */}
            <View style={styles.tileTopRow}>
              <View
                style={[
                  styles.tileIconDisc,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Camera size={21} color={theme.colors.textPrimary} strokeWidth={2} />
              </View>

              <View
                style={[
                  styles.tileLiveBadge,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.10)',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                  },
                ]}
              >
                <View style={styles.tileLiveDot} />
                <Text style={styles.tileLiveText}>LIVE</Text>
              </View>
            </View>

            {/* Bottom Content Block: Left-Aligned Editorial Typography */}
            <View style={styles.tileBottomBlock}>
              <Text
                style={[
                  styles.tileTitleText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                Take Photo
              </Text>
              <Text level="caption" color="secondary" style={styles.tileSubtitleText}>
                Instant snap
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Editorial Quality Hint Row */}
        <View
          style={[
            styles.pickerHintBar,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <Sun
            size={13}
            color={theme.colors.textSecondary}
            strokeWidth={2}
            style={{ marginRight: 7 }}
          />
          <Text level="caption" color="secondary" style={styles.pickerHintText}>
            Natural daylight and relaxed expressions highlight your authenticity
          </Text>
        </View>

        {/* Frictionless Text Dismiss Link */}
        <TouchableOpacity
          onPress={() => {
            setIsPickerModalVisible(false);
            setReplacingPhotoId(null);
          }}
          style={styles.pickerDismissLink}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cancel photo selection"
        >
          <Text style={[styles.pickerDismissText, { color: theme.colors.textSecondary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </SmoothBottomSheetModal>

      {/* ======================================================== */}
      {/* Real Portrait Studio & Filter Modal                      */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isStudioModalVisible}
        onClose={() => {
          setIsStudioModalVisible(false);
          setEditingPhotoId(null);
          setPendingPhotoUri(null);
          setReplacingPhotoId(null);
        }}
        showHandle={true}
        sheetStyle={{ maxHeight: '92%' }}
      >
        {/* Studio Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              Portrait Studio & Filters
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Choose a real editorial filter to elevate your portrait
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setIsStudioModalVisible(false);
              setEditingPhotoId(null);
              setPendingPhotoUri(null);
              setReplacingPhotoId(null);
            }}
            style={[
              styles.modalCloseButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
              },
            ]}
          >
            <X size={15} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Live Photo Preview & In-Box Framing Viewfinder Card */}
        {pendingPhotoUri && (
          <View
            style={[
              styles.studioPreviewCard,
              {
                backgroundColor: isDark ? '#141418' : '#F4F4F6',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7',
              },
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setViewportSize({ width, height });
              }
            }}
          >
            {/* Gesture-driven Animated Image container */}
            <View style={styles.studioGestureWrap} {...panResponder.panHandlers}>
              <View style={styles.studioImageCenterWrap} pointerEvents="none">
                <Animated.Image
                  source={{ uri: pendingPhotoUri }}
                  style={[
                    styles.studioPreviewImage,
                    {
                      width: studioBaseImageSize.width,
                      height: studioBaseImageSize.height,
                      transform: [
                        { translateX: panAnim.x },
                        { translateY: panAnim.y },
                        { scale: scaleAnim },
                      ],
                    },
                  ]}
                  resizeMode="cover"
                />
              </View>
            </View>

            {/* Live Filter Layer */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {renderFilterOverlay(selectedFilterId)}
            </View>

            {/* Viewfinder 4-Corner Framing Reticles */}
            <View style={[styles.reticleTopLeft, styles.cropReticle]} pointerEvents="none" />
            <View style={[styles.reticleTopRight, styles.cropReticle]} pointerEvents="none" />
            <View style={[styles.reticleBottomLeft, styles.cropReticle]} pointerEvents="none" />
            <View style={[styles.reticleBottomRight, styles.cropReticle]} pointerEvents="none" />

            {/* Professional Rule-of-Thirds Grid Overlay */}
            <Animated.View
              style={[styles.studioRuleOfThirdsGrid, { opacity: gridOpacityAnim }]}
              pointerEvents="none"
            >
              <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
              <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
              <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
              <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
            </Animated.View>

            {/* Top HUD Row: Crop status pill & Grid/Reset action icons */}
            <View style={styles.studioTopHudRow} pointerEvents="box-none">
              <View style={styles.studioCropHintPill}>
                <Crop size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.studioCropHintText}>
                  {isInteracting
                    ? 'Framing Portrait'
                    : cropScale > 1.05 ||
                        Math.abs(cropTranslate.x) > 2 ||
                        Math.abs(cropTranslate.y) > 2
                      ? `Framed · ${cropScale.toFixed(1)}x`
                      : 'Pinch / Drag to Crop'}
                </Text>
              </View>

              <View style={styles.studioTopButtonsGroup}>
                <TouchableOpacity
                  onPress={handleToggleGrid}
                  style={[
                    styles.studioHudPillButton,
                    showGrid && { backgroundColor: 'rgba(255, 255, 255, 0.35)' },
                  ]}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle rule of thirds grid"
                >
                  <Grid3X3 size={12} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>

                {(cropScale > 1.02 ||
                  Math.abs(cropTranslate.x) > 1 ||
                  Math.abs(cropTranslate.y) > 1) && (
                  <TouchableOpacity
                    onPress={handleResetCrop}
                    style={styles.studioHudPillButton}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Reset crop and resize"
                  >
                    <RotateCcw size={11} color="#FFFFFF" strokeWidth={2.2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bottom HUD Row: Filter Tag Pill & Zoom Slider/Buttons */}
            <View style={styles.studioBottomHudRow} pointerEvents="box-none">
              <View style={styles.studioFilterTagPill}>
                <SlidersHorizontal size={11} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.studioFilterTagText}>
                  {PHOTO_FILTERS.find((f) => f.id === selectedFilterId)?.name || 'Original'}
                </Text>
              </View>

              <View style={styles.studioZoomControlsGroup}>
                <TouchableOpacity
                  onPress={handleZoomOut}
                  disabled={cropScale <= 1.0}
                  style={[styles.studioZoomStepButton, cropScale <= 1.0 && { opacity: 0.4 }]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                >
                  <Minus size={11} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>

                <View style={styles.studioZoomTextBadge}>
                  <Text style={styles.studioZoomText}>{cropScale.toFixed(1)}x</Text>
                </View>

                <TouchableOpacity
                  onPress={handleZoomIn}
                  disabled={cropScale >= 3.5}
                  style={[styles.studioZoomStepButton, cropScale >= 3.5 && { opacity: 0.4 }]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                >
                  <Plus size={11} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Real Filter Selection Carousel */}
        <View style={styles.studioFiltersSection}>
          <View style={styles.studioFiltersHeaderRow}>
            <Text
              style={[
                styles.sectionHeaderTitle,
                { color: theme.colors.textSecondary, fontFamily: folkraFont, flexShrink: 0 },
              ]}
            >
              CHOOSE A REAL FILTER
            </Text>
            <Text
              level="caption"
              color="tertiary"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.studioFilterTaglineText}
            >
              {PHOTO_FILTERS.find((f) => f.id === selectedFilterId)?.tagline}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.studioFiltersScroll}
          >
            {PHOTO_FILTERS.map((filter) => {
              const isSelected = selectedFilterId === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  onPress={() => {
                    haptics.selection();
                    setSelectedFilterId(filter.id);
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.studioFilterItem,
                    {
                      borderColor: isSelected
                        ? theme.colors.textPrimary
                        : isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : '#E4E4E7',
                      backgroundColor: isDark ? '#16161C' : '#FFFFFF',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter: ${filter.name}`}
                >
                  {/* Filter Thumbnail */}
                  <View style={styles.studioFilterThumbnailWrap}>
                    {pendingPhotoUri ? (
                      <Image
                        source={{ uri: pendingPhotoUri }}
                        style={styles.studioFilterThumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: isDark ? '#222228' : '#EAEAEF' }} />
                    )}
                    {renderFilterOverlay(filter.id)}
                    {isSelected && (
                      <View style={styles.studioFilterCheckBadge}>
                        <Check size={8} color="#000000" strokeWidth={3} />
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.studioFilterName,
                      {
                        color: isSelected ? theme.colors.textPrimary : theme.colors.textSecondary,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {filter.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Action Buttons: Retake & Apply */}
        <View style={styles.studioActionButtonsRow}>
          <TouchableOpacity
            onPress={handleRetakeFromStudio}
            style={[
              styles.studioRetakeButton,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              },
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Retake or change photo"
          >
            <RotateCw size={12.5} color={theme.colors.textPrimary} style={{ marginRight: 5 }} />
            <Text
              style={[styles.studioRetakeText, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              Retake / Change
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirmStudioPhoto}
            style={[
              styles.studioApplyButton,
              {
                backgroundColor: theme.colors.textPrimary,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Apply photo and filter"
          >
            <Text
              style={[
                styles.studioApplyText,
                {
                  color: isDark ? '#000000' : '#FFFFFF',
                  fontFamily: folkraFont,
                },
              ]}
              numberOfLines={1}
            >
              {editingPhotoId
                ? 'Save Filter'
                : activeSlotIndex === 0
                  ? 'Apply Cover Portrait'
                  : 'Apply Photo'}
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    paddingHorizontal: 18,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stepCurrentText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stepDividerText: {
    fontSize: 13.5,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  stepTotalText: {
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  storyProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dashTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 12,
  },
  dashSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  progressTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  uploadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  coverBoxContainer: {
    marginBottom: 24,
  },
  requiredBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requiredBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bigCoverCard: {
    width: '100%',
    height: 295,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  viewfinderCard: {
    borderStyle: 'dashed',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  reticleTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 16,
    height: 16,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopLeftRadius: 8,
  },
  reticleTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 16,
    height: 16,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopRightRadius: 8,
  },
  reticleBottomLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 16,
    height: 16,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomLeftRadius: 8,
  },
  reticleBottomRight: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 16,
    height: 16,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 8,
  },
  viewfinderTopHud: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  viewfinderHudText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  opticalCenterTapZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  opticalOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  breathingHalo: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  centerLens: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lensMiniPlus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderHeadline: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: 4,
    textAlign: 'center',
  },
  viewfinderSubtitle: {
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
    maxWidth: 260,
  },
  studioButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  studioActionButton: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  studioActionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  inlineFilterDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFA07A',
    marginLeft: 4,
  },
  bigCoverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  bigCoverSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  bigCoverTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  bigCoverBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  bigCoverBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bigCoverDeleteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCoverBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  bigCoverBottomContentRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  bigCoverTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.70)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bigCoverSubtitleText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.70)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bigCoverChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
  },
  bigCoverChangeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  secondarySection: {
    marginBottom: 24,
  },
  secondaryRowMedium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  secondaryCardMedium: {
    width: '48.5%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  plusCircleMedium: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  secondaryCardCompact: {
    width: '31.3%',
    height: 135,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  cardTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  slotIndexBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  slotIndexText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  deleteIconButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  cardPromptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyCard: {
    borderStyle: 'dashed',
    justifyContent: 'space-between',
    padding: 10,
  },
  emptySlotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyNumberBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyNumberText: {
    color: 'rgba(255, 255, 255, 0.40)',
    fontSize: 9.5,
    fontWeight: '700',
  },
  emptySlotCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotBottom: {
    alignItems: 'center',
  },
  emptyPromptLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  inspirationSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  inspirationCardList: {
    gap: 9,
  },
  inspirationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  inspirationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspirationTitle: {
    fontWeight: '700',
    marginBottom: 1.5,
  },
  inspirationDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  reassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 18,
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
  },
  professionalCtaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalCtaText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalDragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pickerSlotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pickerEyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pickerSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
  },
  pickerCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  studioDualTilesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  studioDualTile: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 15,
    minHeight: 136,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIconDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCornerPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 4,
  },
  tileLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  tileLiveText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#EF4444',
  },
  tileBottomBlock: {
    marginTop: 18,
  },
  tileTitleText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  tileSubtitleText: {
    fontSize: 12,
    lineHeight: 16,
  },
  pickerHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 0.5,
    marginBottom: 8,
  },
  pickerHintText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  pickerDismissLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  pickerDismissText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bigCoverFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
  },
  filterIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioPreviewCard: {
    width: '100%',
    height: 340,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 14,
  },
  studioGestureWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  studioImageCenterWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  studioPreviewImage: {
    maxWidth: undefined,
    maxHeight: undefined,
  },
  cropReticle: {
    borderColor: 'rgba(255, 255, 255, 0.45)',
    opacity: 0.75,
  },
  studioRuleOfThirdsGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth || 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth || 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  studioTopHudRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studioCropHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  studioCropHintText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  studioTopButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studioHudPillButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioBottomHudRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studioFilterTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  studioFilterTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  studioZoomControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 3,
  },
  studioZoomStepButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  studioZoomTextBadge: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  studioZoomText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  studioFiltersSection: {
    marginBottom: 10,
  },
  studioFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
    gap: 10,
  },
  studioFilterTaglineText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    letterSpacing: -0.1,
  },
  studioFiltersScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  studioFilterItem: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  studioFilterThumbnailWrap: {
    width: 62,
    height: 46,
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  studioFilterThumbImage: {
    width: '100%',
    height: '100%',
  },
  studioFilterCheckBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  studioFilterName: {
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  studioActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  studioRetakeButton: {
    flex: 0.95,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  studioRetakeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  studioApplyButton: {
    flex: 1.35,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  studioApplyText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  modalCancelButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
