import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { motion, type MotionTokens } from '../tokens/motion.js';

let reducedMotionOverride: boolean | null = null;
let currentReducedMotionState: boolean = false;

// Query initial state on module load safely
if (
  typeof AccessibilityInfo !== 'undefined' &&
  typeof AccessibilityInfo.isReduceMotionEnabled === 'function'
) {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      currentReducedMotionState = Boolean(enabled);
    })
    .catch(() => {
      currentReducedMotionState = false;
    });

  if (typeof AccessibilityInfo.addEventListener === 'function') {
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      currentReducedMotionState = Boolean(enabled);
    });
  }
}

/**
 * Programmatic check for whether reduced motion is active.
 * Considers system accessibility settings and optional developer/user overrides.
 */
export function isReducedMotionEnabled(): boolean {
  if (reducedMotionOverride !== null) {
    return reducedMotionOverride;
  }
  return currentReducedMotionState;
}

/**
 * Override reduced motion state explicitly (e.g., in unit tests or user preferences).
 */
export function setReducedMotionOverride(override: boolean | null): void {
  reducedMotionOverride = override;
}

/**
 * Hook to reactively observe reduced motion accessibility preferences.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(isReducedMotionEnabled);

  useEffect(() => {
    if (reducedMotionOverride !== null) {
      setReduced(reducedMotionOverride);
      return;
    }

    let isMounted = true;
    if (
      typeof AccessibilityInfo !== 'undefined' &&
      typeof AccessibilityInfo.isReduceMotionEnabled === 'function'
    ) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (isMounted) setReduced(Boolean(enabled));
        })
        .catch(() => {
          if (isMounted) setReduced(false);
        });

      if (typeof AccessibilityInfo.addEventListener === 'function') {
        const sub = AccessibilityInfo.addEventListener(
          'reduceMotionChanged',
          (enabled: boolean) => {
            if (isMounted) setReduced(Boolean(enabled));
          }
        );
        return () => {
          isMounted = false;
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        };
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return reducedMotionOverride !== null ? reducedMotionOverride : reduced;
}

/**
 * Returns safe animation duration respecting reduced motion settings.
 * When reduced motion is on, returns 0 for instant transition without disorienting movement.
 */
export function getSafeDuration(
  duration: number,
  isReduced: boolean = isReducedMotionEnabled()
): number {
  return isReduced ? 0 : duration;
}

/**
 * Creates an Animated.timing animation that resolves instantly if reduced motion is enabled.
 */
export function createSafeTiming(
  value: Animated.Value | Animated.ValueXY,
  config: Animated.TimingAnimationConfig,
  isReduced: boolean = isReducedMotionEnabled()
): Animated.CompositeAnimation {
  if (isReduced) {
    return Animated.timing(value, {
      ...config,
      duration: 0,
      useNativeDriver: config.useNativeDriver,
    });
  }
  return Animated.timing(value, config);
}

/**
 * Creates an Animated.spring animation that resolves safely if reduced motion is enabled.
 */
export function createSafeSpring(
  value: Animated.Value | Animated.ValueXY,
  config: Animated.SpringAnimationConfig,
  isReduced: boolean = isReducedMotionEnabled()
): Animated.CompositeAnimation {
  if (isReduced) {
    // Substitute timing with duration 0 to avoid spring oscillations
    return Animated.timing(value, {
      toValue: config.toValue as unknown as number,
      duration: 0,
      useNativeDriver: config.useNativeDriver,
    });
  }
  return Animated.spring(value, config);
}

export { motion };
export type { MotionTokens };
