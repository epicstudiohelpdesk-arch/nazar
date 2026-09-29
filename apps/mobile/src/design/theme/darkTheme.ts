import {
  semanticDarkColors,
  typography,
  typographyScale,
  spacing,
  radii,
  shadows,
  elevation,
  motion,
} from '../tokens/index.js';

export const darkTheme = {
  mode: 'dark' as const,
  colors: semanticDarkColors,
  typography,
  typographyScale,
  spacing,
  radii,
  shadows,
  elevation,
  motion,
} as const;

export type DarkAppTheme = typeof darkTheme;
