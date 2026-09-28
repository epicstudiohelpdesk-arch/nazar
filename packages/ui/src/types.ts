import type { ColorTokens } from './tokens/colors.js';
import type { SpacingTokens } from './tokens/spacing.js';
import type { TypographyTokens } from './tokens/typography.js';

export interface ThemeTokens {
  readonly colors: ColorTokens;
  readonly spacing: SpacingTokens;
  readonly typography: TypographyTokens;
}
