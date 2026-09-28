export const colors = {
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
