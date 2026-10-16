export const semanticLightColors = {
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F4EFEA',
  textPrimary: '#1C1917',
  textSecondary: '#57534E',
  textTertiary: '#8C857E',
  textInverse: '#FFFFFF',
  border: '#E7E2DA',
  borderStrong: '#D1C9BE',
  accent: '#DC0C24',
  accentSoft: 'rgba(220, 12, 36, 0.08)',
  accentStrong: '#B80A1E',
  success: '#16A34A',
  successSoft: '#F0FDF4',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  info: '#2563EB',
  infoSoft: '#EFF6FF',
  overlay: 'rgba(28, 25, 23, 0.45)',
  scrim: 'rgba(15, 12, 10, 0.65)',
} as const;

export const semanticDarkColors = {
  background: '#12100E',
  surface: '#1C1917',
  surfaceElevated: '#292524',
  surfaceMuted: '#231F1C',
  textPrimary: '#F5F5F4',
  textSecondary: '#A8A29E',
  textTertiary: '#78716C',
  textInverse: '#1C1917',
  border: '#2E2A27',
  borderStrong: '#44403C',
  accent: '#DC0C24',
  accentSoft: 'rgba(220, 12, 36, 0.16)',
  accentStrong: '#FF2E48',
  success: '#22C55E',
  successSoft: '#14301C',
  warning: '#FBBF24',
  warningSoft: '#382A10',
  error: '#F87171',
  errorSoft: '#391717',
  info: '#60A5FA',
  infoSoft: '#17253E',
  overlay: 'rgba(0, 0, 0, 0.70)',
  scrim: 'rgba(0, 0, 0, 0.85)',
} as const;

export const darkColors = {
  darkBackground: semanticDarkColors.background,
  darkSurface: semanticDarkColors.surface,
  darkSurfaceElevated: semanticDarkColors.surfaceElevated,
  darkTextPrimary: semanticDarkColors.textPrimary,
  darkTextSecondary: semanticDarkColors.textSecondary,
  darkBorder: semanticDarkColors.border,
  darkAccent: semanticDarkColors.accent,
} as const;

export const colors = {
  ...semanticLightColors,
  ...darkColors,
  primary: {
    50: '#fdf2f8',
    100: '#fce7f3',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    900: '#831843',
  },
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    400: '#94a3b8',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

export type ColorTokens = typeof colors;
export type SemanticLightColors = typeof semanticLightColors;
export type SemanticDarkColors = typeof semanticDarkColors;
