import { describe, it, expect } from 'vitest';
import { loadServerConfig, loadClientConfig } from '../src/index.js';

describe('@platform/config', () => {
  it('should load default server configuration successfully', () => {
    const config = loadServerConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DATABASE_URL).toContain('postgresql://');
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
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'production_secret_key_at_least_32_characters_long_string',
      JWT_REFRESH_SECRET: 'production_secret_key_at_least_32_characters_long_string',
    });
    expect(config.PORT).toBe(5500);
    expect(config.NODE_ENV).toBe('production');
  });
});
