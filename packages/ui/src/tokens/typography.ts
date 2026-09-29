export const typographyScale = {
  display: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  heading1: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heading2: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  heading3: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  numeric: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  scale: typographyScale,
} as const;

export type TypographyTokens = typeof typography;
export type TypographyScale = typeof typographyScale;
