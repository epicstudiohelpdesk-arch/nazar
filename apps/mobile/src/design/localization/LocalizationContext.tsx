import React, { createContext, useContext, useState, useMemo } from 'react';
import { defaultStrings, type LocalizationDictionary } from './strings.js';

export type SupportedLocale = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'kn' | 'gu';

interface LocalizationContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (keyPath: string, fallback?: string) => string;
  strings: LocalizationDictionary;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export interface LocalizationProviderProps {
  readonly initialLocale?: SupportedLocale;
  readonly children: React.ReactNode;
}

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({
  initialLocale = 'en',
  children,
}) => {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);

  const t = (keyPath: string, fallback?: string): string => {
    const parts = keyPath.split('.');
    let current: unknown = defaultStrings;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return fallback || keyPath;
      }
    }
    return typeof current === 'string' ? current : fallback || keyPath;
  };

  const value: LocalizationContextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      strings: defaultStrings,
    }),
    [locale]
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useTranslation = (): LocalizationContextValue => {
  const context = useContext(LocalizationContext);
  if (!context) {
    return {
      locale: 'en',
      setLocale: () => {},
      t: (keyPath: string, fallback?: string) => {
        const parts = keyPath.split('.');
        let current: unknown = defaultStrings;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return fallback || keyPath;
          }
        }
        return typeof current === 'string' ? current : fallback || keyPath;
      },
      strings: defaultStrings,
    };
  }
  return context;
};
