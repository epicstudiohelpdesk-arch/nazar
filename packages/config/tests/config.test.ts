import { describe, it, expect } from 'vitest';
import { loadServerConfig, loadClientConfig } from '../src/index.js';

// Gate 1A: staging/production must boot with explicit, non-default secrets.
// Overrides below satisfy the hardened validation so positive tests pass.
const hardenedStagingOverrides = {
  PORT: '5500',
  NODE_ENV: 'staging',
  CORS_ORIGIN: 'https://staging.nazar.app',
  JWT_ACCESS_SECRET: 'staging_secret_key_at_least_32_characters_long_string',
  JWT_REFRESH_SECRET: 'staging_secret_key_at_least_32_characters_long_string',
  DATABASE_URL: 'postgresql://user:pass@db.staging.internal:5432/nazar',
  REDIS_URL: 'redis://:pass@cache.staging.internal:6379/0',
  S3_ACCESS_KEY_ID: 'staging-real-access-key',
  S3_SECRET_ACCESS_KEY: 'staging-real-secret-key',
  FIELD_ENCRYPTION_KEY: 'staging_field_encryption_key_at_least_32_characters_long_string',
};

describe('@platform/config', () => {
  it('should load default server configuration successfully', () => {
    const config = loadServerConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.API_PREFIX).toBe('v1');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.RATE_LIMIT_LIMIT).toBe(100);
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.DATABASE_POOL_MIN).toBe(2);
    expect(config.DATABASE_POOL_MAX).toBe(10);
    expect(config.DATABASE_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(config.DATABASE_IDLE_TIMEOUT_MS).toBe(30000);
    expect(config.DATABASE_STATEMENT_TIMEOUT_MS).toBe(10000);
  });

  it('should load default client configuration without leaking secrets', () => {
    const clientConfig = loadClientConfig({});
    expect(clientConfig.EXPO_PUBLIC_API_URL).toBe('http://localhost:4000/api/v1');
    expect('DATABASE_URL' in clientConfig).toBe(false);
    expect('JWT_ACCESS_SECRET' in clientConfig).toBe(false);
  });

  it('should override configuration with custom environment variables', () => {
    const config = loadServerConfig(hardenedStagingOverrides);
    expect(config.PORT).toBe(5500);
    expect(config.NODE_ENV).toBe('staging');
    expect(config.CORS_ORIGIN).toBe('https://staging.nazar.app');
  });

  it('should reject wildcard CORS in production environment', () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: 'production',
        CORS_ORIGIN: '*',
      })
    ).toThrow('CORS_ORIGIN cannot be wildcard "*"');
  });

  it('Gate 1A: rejects development-default JWT secrets in staging', () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: 'staging',
        JWT_ACCESS_SECRET: 'development_access_secret_do_not_use_in_production_min32chars',
      })
    ).toThrow('JWT_ACCESS_SECRET cannot use insecure development default');
  });

  it('Gate 1A: rejects development-default JWT secrets in production', () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'development_refresh_secret_do_not_use_in_production_min32chars',
      })
    ).toThrow('JWT_REFRESH_SECRET cannot use insecure development default');
  });

  it('Gate 1A/Sprint 1: rejects development-default FIELD_ENCRYPTION_KEY in staging', () => {
    expect(() =>
      loadServerConfig({
        ...hardenedStagingOverrides,
        FIELD_ENCRYPTION_KEY: 'development_field_encryption_key_min32chars_do_not_use_in_prod',
      })
    ).toThrow('FIELD_ENCRYPTION_KEY cannot use insecure development default');
  });

  it('Gate 1A/Sprint 1: rejects development-default FIELD_ENCRYPTION_KEY in production', () => {
    expect(() =>
      loadServerConfig({
        ...hardenedStagingOverrides,
        NODE_ENV: 'production',
        FIELD_ENCRYPTION_KEY: 'development_field_encryption_key_min32chars_do_not_use_in_prod',
      })
    ).toThrow('FIELD_ENCRYPTION_KEY cannot use insecure development default');
  });

  it('Gate 1A: rejects mock billing and unverified providers in staging/production', () => {
    expect(() =>
      loadServerConfig({ ...hardenedStagingOverrides, BILLING_PROVIDER_MOCK: 'true' })
    ).toThrow('BILLING_PROVIDER_MOCK cannot be enabled');
    expect(() =>
      loadServerConfig({ ...hardenedStagingOverrides, BILLING_ALLOW_UNVERIFIED_PROVIDERS: 'true' })
    ).toThrow('BILLING_ALLOW_UNVERIFIED_PROVIDERS cannot be enabled');
  });

  it('Gate 1A: rejects built-in S3 default credentials in staging/production', () => {
    expect(() =>
      loadServerConfig({
        ...hardenedStagingOverrides,
        S3_ACCESS_KEY_ID: 'nazar_minio_admin',
      })
    ).toThrow('S3 credentials cannot use the built-in development defaults');
  });

  it('Gate 1A: federation and mock flags default to disabled (fail-closed)', () => {
    const config = loadServerConfig({});
    expect(config.AUTH_GOOGLE_OAUTH_ENABLED).toBe(false);
    expect(config.AUTH_APPLE_OAUTH_ENABLED).toBe(false);
    expect(config.AUTH_PASSKEY_ENABLED).toBe(false);
    expect(config.BILLING_ALLOW_UNVERIFIED_PROVIDERS).toBe(false);
    expect(config.ADMIN_PROVISIONING_TOKEN).toBeUndefined();
    expect(config.ADMIN_MFA_REQUIRED).toBeUndefined();
  });
});
