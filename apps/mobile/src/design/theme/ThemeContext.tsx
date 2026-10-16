import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, type AppTheme } from './lightTheme.js';
import { darkTheme, type DarkAppTheme } from './darkTheme.js';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColors = AppTheme['colors'] | DarkAppTheme['colors'];

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  theme: AppTheme | DarkAppTheme;
  colors: ThemeColors;
  spacing: AppTheme['spacing'];
  typography: AppTheme['typography'];
  typographyScale: AppTheme['typographyScale'];
  radii: AppTheme['radii'];
  shadows: AppTheme['shadows'];
  elevation: AppTheme['elevation'];
  motion: AppTheme['motion'];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly initialMode?: ThemeMode;
  readonly children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ initialMode = 'dark', children }) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const systemColorScheme = useColorScheme();

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return mode;
  }, [mode, systemColorScheme]);

  const activeTheme = useMemo(() => {
    return resolvedMode === 'dark' ? darkTheme : lightTheme;
  }, [resolvedMode]);

  const value: ThemeContextValue = useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark: resolvedMode === 'dark',
      setMode,
      theme: activeTheme,
      colors: activeTheme.colors,
      spacing: activeTheme.spacing,
      typography: activeTheme.typography,
      typographyScale: activeTheme.typographyScale,
      radii: activeTheme.radii,
      shadows: activeTheme.shadows,
      elevation: activeTheme.elevation,
      motion: activeTheme.motion,
    }),
    [mode, resolvedMode, activeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Default fallback to light theme if outside provider
    return {
      mode: 'light',
      resolvedMode: 'light',
      isDark: false,
      setMode: () => {},
      theme: lightTheme,
      colors: lightTheme.colors,
      spacing: lightTheme.spacing,
      typography: lightTheme.typography,
      typographyScale: lightTheme.typographyScale,
      radii: lightTheme.radii,
      shadows: lightTheme.shadows,
      elevation: lightTheme.elevation,
      motion: lightTheme.motion,
    };
  }
  return context;
};
