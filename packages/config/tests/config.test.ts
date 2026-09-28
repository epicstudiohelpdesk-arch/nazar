import { describe, it, expect } from 'vitest';
import { loadServerConfig, loadClientConfig } from '../src/index.js';

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
    const config = loadServerConfig({
      PORT: '5500',
      NODE_ENV: 'staging',
      CORS_ORIGIN: 'https://staging.nazar.app',
      JWT_ACCESS_SECRET: 'staging_secret_key_at_least_32_characters_long_string',
      JWT_REFRESH_SECRET: 'staging_secret_key_at_least_32_characters_long_string',
    });
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
    ).toThrow('CORS_ORIGIN cannot be wildcard "*" in production environment');
  });
});
