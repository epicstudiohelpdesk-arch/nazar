import { clientEnvSchema, type ClientEnv } from '@platform/config';

export type MobileEnvironment = 'development' | 'test' | 'staging' | 'production';

let cachedConfig: ClientEnv | null = null;

function getDevHost(): string {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'localhost';
  }
  try {
    // Use dynamic require so Node.js test environments without __DEV__ don't throw
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoConstants = require('expo-constants');
    const Constants = (expoConstants?.default ?? expoConstants) as any;
    const hostUri = Constants?.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch {
    // fallback
  }
  return '192.168.31.250';
}

export function getMobileConfig(envOverrides?: Partial<Record<string, string>>): ClientEnv {
  if (cachedConfig && !envOverrides) {
    return cachedConfig;
  }

  const devHost = getDevHost();

  const rawEnv: Record<string, unknown> = {
    EXPO_PUBLIC_APP_ENV:
      envOverrides?.EXPO_PUBLIC_APP_ENV ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_APP_ENV : undefined) ||
      'development',
    EXPO_PUBLIC_API_URL:
      envOverrides?.EXPO_PUBLIC_API_URL ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined) ||
      `http://${devHost}:4000/api/v1`,
    EXPO_PUBLIC_WS_URL:
      envOverrides?.EXPO_PUBLIC_WS_URL ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_WS_URL : undefined) ||
      `ws://${devHost}:4000`,
    EXPO_PUBLIC_APP_VERSION:
      envOverrides?.EXPO_PUBLIC_APP_VERSION ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_APP_VERSION : undefined) ||
      '1.0.0',
    EXPO_PUBLIC_API_VERSION:
      envOverrides?.EXPO_PUBLIC_API_VERSION ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_VERSION : undefined) ||
      'v1',
    EXPO_PUBLIC_SENTRY_DSN:
      envOverrides?.EXPO_PUBLIC_SENTRY_DSN ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_SENTRY_DSN : undefined),
    EXPO_PUBLIC_DEEP_LINK_SCHEME:
      envOverrides?.EXPO_PUBLIC_DEEP_LINK_SCHEME ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEEP_LINK_SCHEME : undefined) ||
      'nazar',
    EXPO_PUBLIC_DEEP_LINK_DOMAIN:
      envOverrides?.EXPO_PUBLIC_DEEP_LINK_DOMAIN ||
      (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEEP_LINK_DOMAIN : undefined) ||
      'nazar.app',
  };

  const parsed = clientEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(
      `[CRITICAL] Invalid mobile configuration for environment '${rawEnv.EXPO_PUBLIC_APP_ENV}': ${errorDetails}`
    );
  }

  if (!envOverrides) {
    cachedConfig = parsed.data;
  }

  return parsed.data;
}

export function resetMobileConfigCache(): void {
  cachedConfig = null;
}
