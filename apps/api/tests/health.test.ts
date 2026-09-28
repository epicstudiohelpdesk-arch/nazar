import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { HealthService } from '../src/modules/health/health.service.js';
import { HealthController } from '../src/modules/health/health.controller.js';

describe('HealthModule', () => {
  it('should return healthy status from HealthService', () => {
    const service = new HealthService();
    const result = service.check();
    expect(result.status).toBe('healthy');
    expect(result.service).toBe('nazar-api');
    expect(typeof result.timestamp).toBe('string');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return health response from HealthController', () => {
    const service = new HealthService();
    const controller = new HealthController(service);
    const result = controller.getHealth();
    expect(result.status).toBe('healthy');
  });
});
