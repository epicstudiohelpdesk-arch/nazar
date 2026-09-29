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
    DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    REDIS_URL: z.string().url().default('redis://:nazar_redis_password@localhost:6379/0'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
      .default('development_access_secret_do_not_use_in_production_min32chars'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
      .default('development_refresh_secret_do_not_use_in_production_min32chars'),
    JWT_ACCESS_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(2592000),
    JWT_ISSUER: z.string().default('nazar-api'),
    JWT_AUDIENCE: z.string().default('nazar-client'),
    OTP_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_LENGTH: z.coerce.number().int().positive().default(6),
    EMAIL_VERIFICATION_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(900),
    GOOGLE_CLIENT_ID: z.string().default('mock-google-client-id'),
    APPLE_CLIENT_ID: z.string().default('mock-apple-client-id'),
    PASSKEY_RP_ID: z.string().default('localhost'),
    PASSKEY_RP_NAME: z.string().default('Nazar Social Discovery'),
    PASSKEY_ORIGIN: z.string().default('http://localhost:3000'),
    S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET_NAME: z.string().default('nazar-media'),
    S3_ACCESS_KEY_ID: z.string().default('nazar_minio_admin'),
    S3_SECRET_ACCESS_KEY: z.string().default('nazar_minio_secret'),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    MEDIA_PUBLIC_URL_PREFIX: z.string().default('http://localhost:9000/nazar-media'),
    MEDIA_UPLOAD_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
    MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(10485760),
    MEDIA_MAX_PHOTOS: z.coerce.number().int().positive().default(6),
    MEDIA_MIN_PHOTOS: z.coerce.number().int().positive().default(1),
    // Gate 10: APNs & FCM Push Provider Config
    APNS_TEAM_ID: z.string().optional(),
    APNS_KEY_ID: z.string().optional(),
    APNS_PRIVATE_KEY: z.string().optional(),
    APNS_BUNDLE_ID: z.string().default('com.nazar.app'),
    APNS_PRODUCTION: z.coerce.boolean().default(false),
    FCM_PROJECT_ID: z.string().optional(),
    FCM_CLIENT_EMAIL: z.string().optional(),
    FCM_PRIVATE_KEY: z.string().optional(),
    PUSH_PROVIDER_MOCK: z.coerce.boolean().default(false),
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
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && data.PUSH_PROVIDER_MOCK) {
        return false;
      }
      return true;
    },
    {
      message: 'PUSH_PROVIDER_MOCK cannot be enabled in production environment',
      path: ['PUSH_PROVIDER_MOCK'],
    }
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;
