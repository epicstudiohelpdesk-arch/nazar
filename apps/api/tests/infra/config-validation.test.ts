import { describe, it, expect } from 'vitest';
import { serverEnvSchema } from '@platform/config';

describe('Production Environment Configuration Validation (Gate 18)', () => {
  const baseValidDev = {
    NODE_ENV: 'development',
    PORT: 4000,
    API_PREFIX: 'v1',
    CORS_ORIGIN: '*',
    DATABASE_URL: 'postgresql://nazar_user:nazar_password@localhost:5432/nazar_db',
    REDIS_URL: 'redis://:nazar_redis_password@localhost:6379/0',
    JWT_ACCESS_SECRET: 'development_access_secret_do_not_use_in_production_min32chars',
    JWT_REFRESH_SECRET: 'development_refresh_secret_do_not_use_in_production_min32chars',
    PUSH_PROVIDER_MOCK: false,
    BILLING_PROVIDER_MOCK: false,
  };

  it('permits default development configuration when NODE_ENV is development', () => {
    const result = serverEnvSchema.safeParse(baseValidDev);
    expect(result.success).toBe(true);
  });

  it('rejects wildcard CORS in production environment', () => {
    const prodConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: '*',
      DATABASE_URL: 'postgresql://user:pass@db.internal.nazar.app:5432/nazar_prod',
      REDIS_URL: 'rediss://user:pass@redis.internal.nazar.app:6379/0',
      JWT_ACCESS_SECRET: 'high_entropy_production_access_key_strictly_64_characters_long_!',
      JWT_REFRESH_SECRET: 'high_entropy_production_refresh_key_strictly_64_characters_long_!',
    };

    const result = serverEnvSchema.safeParse(prodConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('CORS_ORIGIN'))).toBe(true);
    }
  });

  it('rejects default development JWT secrets in production environment', () => {
    const prodConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://nazar.app',
      DATABASE_URL: 'postgresql://user:pass@db.internal.nazar.app:5432/nazar_prod',
      REDIS_URL: 'rediss://user:pass@redis.internal.nazar.app:6379/0',
      JWT_ACCESS_SECRET: 'development_access_secret_do_not_use_in_production_min32chars',
      JWT_REFRESH_SECRET: 'development_refresh_secret_do_not_use_in_production_min32chars',
    };

    const result = serverEnvSchema.safeParse(prodConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('JWT_ACCESS_SECRET'))).toBe(true);
      expect(result.error.issues.some((i) => i.path.includes('JWT_REFRESH_SECRET'))).toBe(true);
    }
  });

  it('rejects localhost database URL in production environment', () => {
    const prodConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://nazar.app',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/nazar_prod',
      REDIS_URL: 'rediss://user:pass@redis.internal.nazar.app:6379/0',
      JWT_ACCESS_SECRET: 'high_entropy_production_access_key_strictly_64_characters_long_!',
      JWT_REFRESH_SECRET: 'high_entropy_production_refresh_key_strictly_64_characters_long_!',
    };

    const result = serverEnvSchema.safeParse(prodConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true);
    }
  });

  it('rejects localhost Redis URL in production environment', () => {
    const prodConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://nazar.app',
      DATABASE_URL: 'postgresql://user:pass@db.internal.nazar.app:5432/nazar_prod',
      REDIS_URL: 'redis://127.0.0.1:6379/0',
      JWT_ACCESS_SECRET: 'high_entropy_production_access_key_strictly_64_characters_long_!',
      JWT_REFRESH_SECRET: 'high_entropy_production_refresh_key_strictly_64_characters_long_!',
    };

    const result = serverEnvSchema.safeParse(prodConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('REDIS_URL'))).toBe(true);
    }
  });

  it('rejects mock push and billing providers in production environment', () => {
    const prodConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://nazar.app',
      DATABASE_URL: 'postgresql://user:pass@db.internal.nazar.app:5432/nazar_prod',
      REDIS_URL: 'rediss://user:pass@redis.internal.nazar.app:6379/0',
      JWT_ACCESS_SECRET: 'high_entropy_production_access_key_strictly_64_characters_long_!',
      JWT_REFRESH_SECRET: 'high_entropy_production_refresh_key_strictly_64_characters_long_!',
      PUSH_PROVIDER_MOCK: true,
      BILLING_PROVIDER_MOCK: true,
    };

    const result = serverEnvSchema.safeParse(prodConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('PUSH_PROVIDER_MOCK'))).toBe(true);
      expect(result.error.issues.some((i) => i.path.includes('BILLING_PROVIDER_MOCK'))).toBe(true);
    }
  });

  it('accepts fully compliant production configuration', () => {
    const validProdConfig = {
      ...baseValidDev,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://nazar.app,https://admin.nazar.app',
      DATABASE_URL: 'postgresql://prod_user:prod_pass@db.internal.nazar.app:5432/nazar_prod',
      REDIS_URL: 'rediss://prod_user:prod_pass@redis.internal.nazar.app:6379/0',
      JWT_ACCESS_SECRET: 'prod_access_secret_entropy_64_characters_high_random_key_abc_123',
      JWT_REFRESH_SECRET: 'prod_refresh_secret_entropy_64_characters_high_random_key_def_456',
      PUSH_PROVIDER_MOCK: false,
      BILLING_PROVIDER_MOCK: false,
    };

    const result = serverEnvSchema.safeParse(validProdConfig);
    expect(result.success).toBe(true);
  });
});
