import { z } from 'zod';

/**
 * Environments that face untrusted traffic and therefore must never run on
 * development defaults. Staging is intentionally included: it is reachable by
 * staff and often shares trust boundaries with production systems.
 */
const isHardenedEnvironment = (nodeEnv: string): boolean =>
  nodeEnv === 'production' || nodeEnv === 'staging';

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
    FIELD_ENCRYPTION_KEY: z
      .string()
      .min(32, 'FIELD_ENCRYPTION_KEY must be at least 32 characters')
      .default('development_field_encryption_key_min32chars_do_not_use_in_prod'),
    JWT_ACCESS_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(2592000),
    JWT_ISSUER: z.string().default('nazar-api'),
    JWT_AUDIENCE: z.string().default('nazar-client'),
    OTP_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_LENGTH: z.coerce.number().int().positive().default(6),
    EMAIL_VERIFICATION_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(900),
    // Gate 1B: audiences are an explicit allowlist. There is intentionally no
    // built-in default (the old hard-coded Google client ID and the
    // `mock-apple-client-id` bypass were removed). When no audience is
    // configured the corresponding provider fails closed.
    GOOGLE_CLIENT_ID: z.string().default(''),
    APPLE_CLIENT_ID: z.string().default(''),
    // Gate 1B: optional client secrets for server-side authorization-code
    // exchange. Google mobile clients normally use PKCE only; Apple requires a
    // client secret (static or generated from the Sign in with Apple key).
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    APPLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    APPLE_SIGN_IN_TEAM_ID: z.string().optional(),
    APPLE_SIGN_IN_KEY_ID: z.string().optional(),
    APPLE_SIGN_IN_PRIVATE_KEY: z.string().optional(),
    // Gate 1B: identity-provider endpoints as explicit configuration.
    GOOGLE_JWKS_URL: z.string().url().default('https://www.googleapis.com/oauth2/v3/certs'),
    GOOGLE_TOKEN_URL: z.string().url().default('https://oauth2.googleapis.com/token'),
    APPLE_JWKS_URL: z.string().url().default('https://appleid.apple.com/auth/keys'),
    APPLE_TOKEN_URL: z.string().url().default('https://appleid.apple.com/auth/token'),
    GOOGLE_ISSUERS: z.string().default('accounts.google.com,https://accounts.google.com'),
    APPLE_ISSUERS: z.string().default('https://appleid.apple.com'),
    // Gate 1B: allowed OAuth redirect targets (exact match, comma separated)
    OAUTH_REDIRECT_ALLOWLIST: z.string().default(''),
    PASSKEY_RP_ID: z.string().default('localhost'),
    PASSKEY_RP_NAME: z.string().default('Nazar Social Discovery'),
    PASSKEY_ORIGIN: z.string().default('http://localhost:3000'),
    // Gate 1B: additional trusted origins (comma separated) for WebAuthn.
    PASSKEY_ALLOWED_ORIGINS: z.string().default(''),
    // Gate 1B: WebAuthn verification policy
    PASSKEY_USER_VERIFICATION: z
      .enum(['required', 'preferred', 'discouraged'])
      .default('preferred'),
    PASSKEY_ATTESTATION: z.enum(['none', 'indirect', 'direct']).default('none'),
    PASSKEY_RESIDENT_KEY: z.enum(['required', 'preferred', 'discouraged']).default('preferred'),
    PASSKEY_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
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
    // Gate 11: Apple & Google Play Billing Provider Config
    APPLE_BILLING_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    APPLE_ISSUER_ID: z.string().optional(),
    APPLE_KEY_ID: z.string().optional(),
    APPLE_BUNDLE_ID: z.string().default('com.nazar.app'),
    APPLE_PRIVATE_KEY: z.string().optional(),
    GOOGLE_PLAY_PACKAGE_NAME: z.string().default('com.nazar.app'),
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    BILLING_PROVIDER_MOCK: z.coerce.boolean().default(false),
    // Gate 1A: allows Apple/Google purchase & webhook processing to run WITHOUT
    // cryptographic verification (decode-only). MUST remain false outside
    // local development until Gate 1C ships real signature verification.
    BILLING_ALLOW_UNVERIFIED_PROVIDERS: z.coerce.boolean().default(false),
    // Gate 1A: Administrator provisioning & authentication policy
    // One-time enrollment secret required to provision administrators in
    // hardened (staging/production) environments. Never set a default.
    ADMIN_PROVISIONING_TOKEN: z.string().min(32).optional(),
    // Enforce MFA for privileged administrators. Defaults to true in
    // staging/production when unset (see AppConfigService.adminMfaRequired).
    ADMIN_MFA_REQUIRED: z.coerce.boolean().optional(),
    // Gate 1A: identity-federation kill switches. These providers currently
    // lack cryptographic verification (Gate 1B scope) and must stay disabled
    // unless an operator explicitly enables them in a controlled environment.
    AUTH_GOOGLE_OAUTH_ENABLED: z.coerce.boolean().default(false),
    AUTH_APPLE_OAUTH_ENABLED: z.coerce.boolean().default(false),
    AUTH_PASSKEY_ENABLED: z.coerce.boolean().default(false),
    // Google Gemini AI Configuration
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_API_KEY: z.string().optional(),
    // Firebase Authentication Configuration
    FIREBASE_PROJECT_ID: z.string().default('nazar-85664'),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  })
  .refine(
    () => {
      if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
        const secret = process.env.VERIFICATION_SECRET;
        if (!secret || secret.length < 32) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'VERIFICATION_SECRET is required in staging or production environment',
      path: ['VERIFICATION_SECRET'],
    }
  )
  .refine(
    (data) => {
      if (data.GEMINI_MODEL === 'skimaki-agy-fast' || data.GEMINI_MODEL.includes('skimaki')) {
        return false;
      }
      return true;
    },
    {
      message:
        'Invalid GEMINI_MODEL: "skimaki-agy-fast" is not a supported Gemini model for generateContent. Use a verified model such as "gemini-2.5-flash".',
      path: ['GEMINI_MODEL'],
    }
  )
  .refine(
    (data) => {
      if (isHardenedEnvironment(data.NODE_ENV) && data.CORS_ORIGIN === '*') {
        return false;
      }
      return true;
    },
    {
      message: 'CORS_ORIGIN cannot be wildcard "*" in staging or production environment',
      path: ['CORS_ORIGIN'],
    }
  )
  .refine(
    (data) => {
      if (isHardenedEnvironment(data.NODE_ENV) && data.PUSH_PROVIDER_MOCK) {
        return false;
      }
      return true;
    },
    {
      message: 'PUSH_PROVIDER_MOCK cannot be enabled in staging or production environment',
      path: ['PUSH_PROVIDER_MOCK'],
    }
  )
  .refine(
    (data) => {
      if (isHardenedEnvironment(data.NODE_ENV) && data.BILLING_PROVIDER_MOCK) {
        return false;
      }
      return true;
    },
    {
      message: 'BILLING_PROVIDER_MOCK cannot be enabled in staging or production environment',
      path: ['BILLING_PROVIDER_MOCK'],
    }
  )
  .refine(
    (data) => {
      if (isHardenedEnvironment(data.NODE_ENV) && data.BILLING_ALLOW_UNVERIFIED_PROVIDERS) {
        return false;
      }
      return true;
    },
    {
      message:
        'BILLING_ALLOW_UNVERIFIED_PROVIDERS cannot be enabled in staging or production environment: Apple/Google purchase verification is not cryptographically verified until Gate 1C',
      path: ['BILLING_ALLOW_UNVERIFIED_PROVIDERS'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        data.AUTH_GOOGLE_OAUTH_ENABLED &&
        data.GOOGLE_CLIENT_ID.trim() === ''
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'GOOGLE_CLIENT_ID must be set when AUTH_GOOGLE_OAUTH_ENABLED=true in staging or production',
      path: ['GOOGLE_CLIENT_ID'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        data.AUTH_APPLE_OAUTH_ENABLED &&
        data.APPLE_CLIENT_ID.trim() === ''
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'APPLE_CLIENT_ID must be set when AUTH_APPLE_OAUTH_ENABLED=true in staging or production',
      path: ['APPLE_CLIENT_ID'],
    }
  )
  .refine(
    (data) => {
      if (!isHardenedEnvironment(data.NODE_ENV) || !data.AUTH_PASSKEY_ENABLED) {
        return true;
      }
      // WebAuthn requires a secure context. `localhost` is only acceptable for
      // local development, never for a hardened environment.
      if (!data.PASSKEY_ORIGIN.startsWith('https://')) {
        return false;
      }
      if (data.PASSKEY_RP_ID === 'localhost' || data.PASSKEY_RP_ID === '127.0.0.1') {
        return false;
      }
      return true;
    },
    {
      message:
        'PASSKEY_ORIGIN must be https and PASSKEY_RP_ID must be a real domain when AUTH_PASSKEY_ENABLED=true in staging or production',
      path: ['PASSKEY_ORIGIN'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.AUTH_GOOGLE_OAUTH_ENABLED || data.AUTH_APPLE_OAUTH_ENABLED) &&
        data.OAUTH_REDIRECT_ALLOWLIST.trim() === ''
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'OAUTH_REDIRECT_ALLOWLIST must be set when Google/Apple OAuth is enabled in staging or production',
      path: ['OAUTH_REDIRECT_ALLOWLIST'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.JWT_ACCESS_SECRET.includes('development') ||
          data.JWT_ACCESS_SECRET ===
            'development_access_secret_do_not_use_in_production_min32chars')
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'JWT_ACCESS_SECRET cannot use insecure development default in staging or production environment',
      path: ['JWT_ACCESS_SECRET'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.JWT_REFRESH_SECRET.includes('development') ||
          data.JWT_REFRESH_SECRET ===
            'development_refresh_secret_do_not_use_in_production_min32chars')
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'JWT_REFRESH_SECRET cannot use insecure development default in staging or production environment',
      path: ['JWT_REFRESH_SECRET'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.FIELD_ENCRYPTION_KEY.includes('development') ||
          data.FIELD_ENCRYPTION_KEY ===
            'development_field_encryption_key_min32chars_do_not_use_in_prod')
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'FIELD_ENCRYPTION_KEY cannot use insecure development default in staging or production environment',
      path: ['FIELD_ENCRYPTION_KEY'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.DATABASE_URL.includes('localhost') || data.DATABASE_URL.includes('127.0.0.1'))
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'DATABASE_URL cannot point to localhost in staging or production environment',
      path: ['DATABASE_URL'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.REDIS_URL.includes('localhost') || data.REDIS_URL.includes('127.0.0.1'))
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'REDIS_URL cannot point to localhost in staging or production environment',
      path: ['REDIS_URL'],
    }
  )
  .refine(
    (data) => {
      if (
        isHardenedEnvironment(data.NODE_ENV) &&
        (data.S3_ACCESS_KEY_ID === 'nazar_minio_admin' ||
          data.S3_SECRET_ACCESS_KEY === 'nazar_minio_secret')
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'S3 credentials cannot use the built-in development defaults in staging or production environment',
      path: ['S3_ACCESS_KEY_ID'],
    }
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;
