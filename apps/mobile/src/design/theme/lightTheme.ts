import {
  semanticLightColors,
  typography,
  typographyScale,
  spacing,
  radii,
  shadows,
  elevation,
  motion,
} from '../tokens/index.js';

export const lightTheme = {
  mode: 'light' as const,
  colors: semanticLightColors,
  typography,
  typographyScale,
  spacing,
  radii,
  shadows,
  elevation,
  motion,
} as const;

export type AppTheme = typeof lightTheme;
