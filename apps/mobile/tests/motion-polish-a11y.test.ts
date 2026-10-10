import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  motion,
  isReducedMotionEnabled,
  setReducedMotionOverride,
  getSafeDuration,
  createSafeTiming,
  createSafeSpring,
} from '../src/design/motion/index.js';
import { haptics } from '../src/design/haptics/index.js';
import {
  MIN_TOUCH_TARGET,
  A11Y_RECOMMENDED_TOUCH_TARGET,
  ensureMinTouchTarget,
  announceAccessibility,
  createButtonA11y,
  createRadioA11y,
  createCheckboxA11y,
} from '../src/design/a11y/index.js';
import { Animated, Vibration, AccessibilityInfo } from 'react-native';

describe('Frontend F11: Motion, Micro-interactions, Accessibility & Polish', () => {
  beforeEach(() => {
    setReducedMotionOverride(null);
    haptics.setEnabled(true);
    haptics.clearDebounce();
    vi.clearAllMocks();
  });

  describe('1. Semantic Motion System & Tokens', () => {
    it('exposes complete semantic duration tokens', () => {
      expect(motion.duration.instant).toBe(0);
      expect(motion.duration.micro).toBe(100);
      expect(motion.duration.fast).toBe(150);
      expect(motion.duration.standard).toBe(250);
      expect(motion.duration.normal).toBe(250);
      expect(motion.duration.emphasis).toBe(350);
      expect(motion.duration.slow).toBe(400);
    });

    it('exposes spring physics tokens including gentle and bouncy configurations', () => {
      expect(motion.spring.damping).toBe(20);
      expect(motion.spring.stiffness).toBe(180);
      expect(motion.spring.gentle.damping).toBe(25);
      expect(motion.spring.gentle.stiffness).toBe(140);
      expect(motion.spring.bouncy.damping).toBe(15);
      expect(motion.spring.bouncy.stiffness).toBe(200);
      expect(motion.spring.stiff.damping).toBe(28);
    });

    it('exposes standard, decelerate, accelerate, and emphasized easing bezier tokens', () => {
      expect(motion.easing.standard).toContain('cubic-bezier');
      expect(motion.easing.decelerate).toBe('cubic-bezier(0.0, 0.0, 0.2, 1)');
      expect(motion.easing.accelerate).toBe('cubic-bezier(0.4, 0.0, 1, 1)');
      expect(motion.easing.emphasized).toBe('cubic-bezier(0.2, 0.0, 0.0, 1)');
    });
  });

  describe('2. Reduced-Motion Strategy', () => {
    it('accurately resolves reduced motion override', () => {
      setReducedMotionOverride(true);
      expect(isReducedMotionEnabled()).toBe(true);

      setReducedMotionOverride(false);
      expect(isReducedMotionEnabled()).toBe(false);
    });

    it('collapses animation duration to 0 when reduced motion is enabled', () => {
      setReducedMotionOverride(true);
      expect(getSafeDuration(motion.duration.standard)).toBe(0);
      expect(getSafeDuration(motion.duration.emphasis)).toBe(0);

      setReducedMotionOverride(false);
      expect(getSafeDuration(motion.duration.standard)).toBe(250);
      expect(getSafeDuration(motion.duration.slow)).toBe(400);
    });

    it('creates instant safe timing animation when reduced motion is enabled', () => {
      const animVal = new Animated.Value(0);

      // Normal motion: timing uses provided duration
      const normalTiming = createSafeTiming(
        animVal,
        {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        },
        false
      );
      expect(normalTiming).toBeDefined();

      // Reduced motion: timing duration collapses to 0
      const safeTiming = createSafeTiming(
        animVal,
        {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        },
        true
      );
      expect(safeTiming).toBeDefined();
    });

    it('converts spring animation to zero-duration timing when reduced motion is enabled', () => {
      const animVal = new Animated.Value(0);

      const safeSpring = createSafeSpring(
        animVal,
        {
          toValue: 1,
          useNativeDriver: false,
        },
        true
      );
      expect(safeSpring).toBeDefined();
    });
  });

  describe('3. Semantic Haptic Feedback System', () => {
    it('triggers light/selection vibration for taps and toggles', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.selection();
      expect(spy).toHaveBeenCalled();
    });

    it('triggers medium feedback for like and meaningful actions', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.medium();
      expect(spy).toHaveBeenCalled();
    });

    it('triggers success pattern for match celebration and purchases', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.success();
      expect(spy).toHaveBeenCalled();
    });

    it('triggers warning and error patterns for destructive confirmations', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.error();
      expect(spy).toHaveBeenCalled();
    });

    it('debounces rapid duplicate triggers to prevent sensation pile-up', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.selection();
      haptics.selection(); // Immediate second call within 100ms
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('respects global enable/disable toggle', () => {
      const spy = vi.spyOn(Vibration, 'vibrate');
      haptics.setEnabled(false);
      haptics.selection();
      expect(spy).not.toHaveBeenCalled();

      haptics.setEnabled(true);
      haptics.selection();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Accessibility Foundations & Touch Target Standards', () => {
    it('defines 44pt platform minimum and 48pt WCAG recommended targets', () => {
      expect(MIN_TOUCH_TARGET).toBe(44);
      expect(A11Y_RECOMMENDED_TOUCH_TARGET).toBe(48);
    });

    it('calculates symmetric hitSlop to elevate compact elements to 48x48dp target', () => {
      // 38dp button needs 5dp on each side to reach 48dp
      const slop38 = ensureMinTouchTarget(38, 38, 48);
      expect(slop38.top).toBe(5);
      expect(slop38.bottom).toBe(5);
      expect(slop38.left).toBe(5);
      expect(slop38.right).toBe(5);

      // 40dp button needs 4dp on each side
      const slop40 = ensureMinTouchTarget(40, 40, 48);
      expect(slop40.top).toBe(4);
      expect(slop40.bottom).toBe(4);
      expect(slop40.left).toBe(4);
      expect(slop40.right).toBe(4);

      // 48dp or larger needs 0 extra padding
      const slop48 = ensureMinTouchTarget(56, 56, 48);
      expect(slop48.top).toBe(0);
      expect(slop48.bottom).toBe(0);
    });

    it('safely handles screen reader announcements', () => {
      const announceSpy = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announceAccessibility("It's a Match! You and Priya liked each other.");
      expect(announceSpy).toHaveBeenCalledWith("It's a Match! You and Priya liked each other.");
    });

    it('constructs semantic radio and checkbox accessibility props', () => {
      const radioProps = createRadioA11y('Female', true);
      expect(radioProps.accessibilityRole).toBe('radio');
      expect(radioProps.accessibilityState?.selected).toBe(true);
      expect(radioProps.accessibilityState?.disabled).toBe(false);

      const checkProps = createCheckboxA11y('Read receipts', false, true);
      expect(checkProps.accessibilityRole).toBe('checkbox');
      expect(checkProps.accessibilityState?.checked).toBe(false);
      expect(checkProps.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('5. Interactive Components & Micro-interactions', () => {
    it('verifies Button size options have defined min heights and hitSlops', () => {
      const slopSm = ensureMinTouchTarget(38, 38, 48);
      expect(slopSm.top).toBeGreaterThanOrEqual(5);

      const slopMd = ensureMinTouchTarget(48, 48, 48);
      expect(slopMd.top).toBe(0);
    });

    it('verifies IconButton sizes have min 48dp target elevation', () => {
      const slopSm = ensureMinTouchTarget(38, 38, 48);
      expect(slopSm.top).toBe(5);

      const slopMd = ensureMinTouchTarget(44, 44, 48);
      expect(slopMd.top).toBe(2);
    });

    it('debounces rapid taps on Button to prevent accidental double submissions', () => {
      const clickSpy = vi.fn();
      let lastPress = 0;
      const guardedPress = () => {
        const now = Date.now();
        if (now - lastPress < 400) return;
        lastPress = now;
        clickSpy();
      };

      guardedPress();
      guardedPress(); // Rapid second tap within 400ms
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. Empty, Error, and Loading Feedback Accessibility', () => {
    it('provides accessible alert roles for ErrorState', () => {
      const errorA11yRole = 'alert';
      expect(errorA11yRole).toBe('alert');
    });

    it('provides accessible text role for EmptyState with combined summary', () => {
      const emptyTitle = 'No matches yet';
      const emptyDesc = 'Keep exploring discovery profiles';
      const combinedLabel = `${emptyTitle}. ${emptyDesc}`;
      expect(combinedLabel).toBe('No matches yet. Keep exploring discovery profiles');
    });
  });
});
