import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@platform/api-contracts';

@Injectable()
export class HealthService {
  private readonly startupTime = Date.now();

  check(): HealthCheckResponse {
    return {
      status: 'healthy',
      service: 'nazar-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startupTime) / 1000),
    };
  }
}
