import type { ColorTokens, SemanticLightColors, SemanticDarkColors } from './tokens/colors.js';
import type { SpacingTokens } from './tokens/spacing.js';
import type { TypographyTokens, TypographyScale } from './tokens/typography.js';
import type { RadiiTokens } from './tokens/radii.js';
import type { ShadowTokens } from './tokens/shadows.js';
import type { ElevationTokens } from './tokens/elevation.js';
import type { MotionTokens } from './tokens/motion.js';

export interface ThemeTokens {
  readonly colors: ColorTokens;
  readonly spacing: SpacingTokens;
  readonly typography: TypographyTokens;
  readonly typographyScale: TypographyScale;
  readonly radii: RadiiTokens;
  readonly shadows: ShadowTokens;
  readonly elevation: ElevationTokens;
  readonly motion: MotionTokens;
}

export type {
  ColorTokens,
  SemanticLightColors,
  SemanticDarkColors,
  SpacingTokens,
  TypographyTokens,
  TypographyScale,
  RadiiTokens,
  ShadowTokens,
  ElevationTokens,
  MotionTokens,
};
