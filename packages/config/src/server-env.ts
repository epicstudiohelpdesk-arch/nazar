import { z } from 'zod';

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().default('v1'),
    CORS_ORIGIN: z.string().default('*'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    APP_NAME: z.string().default('nazar-api'),
    APP_VERSION: z.string().default('0.1.0'),
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://nazar_user:nazar_password@localhost:5432/nazar_db'),
    REDIS_URL: z.string().url().default('redis://:nazar_redis_password@localhost:6379/0'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
      .default('development_access_secret_do_not_use_in_production_min32chars'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
      .default('development_refresh_secret_do_not_use_in_production_min32chars'),
    S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET_NAME: z.string().default('nazar-media'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && data.CORS_ORIGIN === '*') {
        return false;
      }
      return true;
    },
    {
      message: 'CORS_ORIGIN cannot be wildcard "*" in production environment',
      path: ['CORS_ORIGIN'],
    }
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;
