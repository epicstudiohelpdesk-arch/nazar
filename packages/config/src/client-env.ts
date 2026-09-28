import { z } from 'zod';

export const clientEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
  EXPO_PUBLIC_WS_URL: z.string().url().default('ws://localhost:4000'),
  EXPO_PUBLIC_APP_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
