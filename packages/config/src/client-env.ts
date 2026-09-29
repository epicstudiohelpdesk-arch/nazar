import { z } from 'zod';

export const clientEnvSchema = z
  .object({
    EXPO_PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
    EXPO_PUBLIC_WS_URL: z.string().url().default('ws://localhost:4000'),
    EXPO_PUBLIC_APP_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),
    EXPO_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
    EXPO_PUBLIC_API_VERSION: z.string().default('v1'),
    EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
    EXPO_PUBLIC_DEEP_LINK_SCHEME: z.string().default('nazar'),
    EXPO_PUBLIC_DEEP_LINK_DOMAIN: z.string().default('nazar.app'),
  })
  .superRefine((data, ctx) => {
    if (data.EXPO_PUBLIC_APP_ENV === 'production') {
      const isLocalApi =
        data.EXPO_PUBLIC_API_URL.includes('localhost') ||
        data.EXPO_PUBLIC_API_URL.includes('127.0.0.1') ||
        data.EXPO_PUBLIC_API_URL.startsWith('http://');
      if (isLocalApi) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production mobile builds must use a secure remote HTTPS API endpoint (cannot use localhost or unencrypted http).',
          path: ['EXPO_PUBLIC_API_URL'],
        });
      }

      const isLocalWs =
        data.EXPO_PUBLIC_WS_URL.includes('localhost') ||
        data.EXPO_PUBLIC_WS_URL.includes('127.0.0.1') ||
        data.EXPO_PUBLIC_WS_URL.startsWith('ws://');
      if (isLocalWs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production mobile builds must use a secure remote WSS WebSocket endpoint (cannot use localhost or unencrypted ws).',
          path: ['EXPO_PUBLIC_WS_URL'],
        });
      }
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;
