export const spacing = {
  none: 0,
  xxs: 4,
  xs: 4,
  sm: 8,
  md: 16,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
  massive: 80,
  // Numeric scale index
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  80: 80,
} as const;

export type SpacingTokens = typeof spacing;
