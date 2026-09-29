export const elevation = {
  none: 0,
  sm: 1,
  md: 3,
  lg: 6,
  xl: 10,
} as const;

export type ElevationTokens = typeof elevation;
