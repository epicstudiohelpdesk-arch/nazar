import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { HealthService } from '../src/health/health.service.js';
import { ProcessHealthIndicator } from '../src/health/indicators/process-health.indicator.js';
import type { AppConfigService } from '../src/config/app-config.service.js';

describe('HealthService Unit Tests', () => {
  const mockConfig: AppConfigService = {
    appName: 'nazar-api-test',
    appVersion: '1.0.0-test',
    nodeEnv: 'test',
    port: 4000,
    apiPrefix: 'v1',
    logLevel: 'info',
    corsOrigin: '*',
    rateLimitTtlMs: 60000,
    rateLimitLimit: 100,
    isProduction: false,
    isDevelopment: false,
    isTest: true,
  };

  it('should return healthy liveness probe', () => {
    const service = new HealthService(mockConfig, []);
    const liveness = service.checkLiveness();

    expect(liveness.status).toBe('healthy');
    expect(liveness.service).toBe('nazar-api-test');
    expect(liveness.version).toBe('1.0.0-test');
    expect(typeof liveness.timestamp).toBe('string');
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return readiness probe with indicators', async () => {
    const indicator = new ProcessHealthIndicator();
    const service = new HealthService(mockConfig, [indicator]);

    const readiness = await service.checkReadiness();
    expect(readiness.status).toBe('healthy');
    expect(readiness.checks.process).toBeDefined();
    expect(readiness.checks.process.status).toBe('healthy');
  });

  it('should report unhealthy readiness if an indicator fails', async () => {
    const failingIndicator = {
      name: 'critical-subsystem',
      check: async () => ({
        status: 'unhealthy' as const,
        message: 'Subsystem connection timeout',
      }),
    };

    const service = new HealthService(mockConfig, [failingIndicator]);
    const readiness = await service.checkReadiness();

    expect(readiness.status).toBe('unhealthy');
    expect(readiness.checks['critical-subsystem'].status).toBe('unhealthy');
  });
});
