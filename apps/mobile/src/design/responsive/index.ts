import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const getWindowDimensions = (): ScaledSize => {
  return Dimensions.get('window');
};

/**
 * Linearly scales a size according to the current screen width, with min/max clamps.
 */
export const scale = (size: number): number => {
  const { width } = getWindowDimensions();
  const ratio = width / BASE_WIDTH;
  const clampedRatio = Math.min(Math.max(ratio, 0.85), 1.25);
  return Math.round(size * clampedRatio);
};

/**
 * Linearly scales a size according to the current screen height, with min/max clamps.
 */
export const verticalScale = (size: number): number => {
  const { height } = getWindowDimensions();
  const ratio = height / BASE_HEIGHT;
  const clampedRatio = Math.min(Math.max(ratio, 0.85), 1.25);
  return Math.round(size * clampedRatio);
};

/**
 * Moderately scales a size (scaling by factor, default 0.5) to avoid excessive sizing on large screens.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  const scaled = scale(size);
  return Math.round(size + (scaled - size) * factor);
};

export interface ResponsiveLayout {
  width: number;
  height: number;
  isSmallScreen: boolean; // < 380pt (e.g. iPhone SE)
  isMediumScreen: boolean; // 380pt - 420pt (standard phones)
  isLargeScreen: boolean; // > 420pt (e.g. iPhone 15/16 Pro Max, Plus)
  isTablet: boolean; // >= 600pt
  horizontalPadding: number;
  cardWidth: number;
  maxContentWidth: number;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const [dimensions, setDimensions] = useState(getWindowDimensions);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove?.();
  }, []);

  const { width, height } = dimensions;
  const isSmallScreen = width < 380;
  const isLargeScreen = width > 420;
  const isTablet = width >= 600;
  const isMediumScreen = !isSmallScreen && !isLargeScreen && !isTablet;

  const horizontalPadding = isSmallScreen ? 14 : isLargeScreen ? 20 : 16;
  const maxContentWidth = Math.min(width - horizontalPadding * 2, 440);
  const cardWidth = Math.min(width - (isSmallScreen ? 16 : 24), 420);

  return {
    width,
    height,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    isTablet,
    horizontalPadding,
    cardWidth,
    maxContentWidth,
  };
}
