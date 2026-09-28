import { Injectable, Inject } from '@nestjs/common';
import type {
  HealthCheckResponse,
  ReadinessCheckResponse,
  ReadinessIndicatorResult,
  ServiceHealthStatus,
} from '@platform/api-contracts';
import { AppConfigService } from '../config/app-config.service.js';
import {
  type HealthIndicator,
  HEALTH_INDICATOR_TOKEN,
} from './indicators/health-indicator.interface.js';

@Injectable()
export class HealthService {
  private readonly startupTime = Date.now();

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(HEALTH_INDICATOR_TOKEN)
    private readonly indicators: HealthIndicator[]
  ) {}

  checkLiveness(): HealthCheckResponse {
    return {
      status: 'healthy',
      service: this.config.appName,
      version: this.config.appVersion,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startupTime) / 1000),
    };
  }

  async checkReadiness(): Promise<ReadinessCheckResponse> {
    const checks: Record<string, ReadinessIndicatorResult> = {};
    let overallStatus: ServiceHealthStatus = 'healthy';

    for (const indicator of this.indicators) {
      try {
        const result = await indicator.check();
        checks[indicator.name] = result;

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (err: unknown) {
        checks[indicator.name] = {
          status: 'unhealthy',
          message: err instanceof Error ? err.message : 'Unknown indicator failure',
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      service: this.config.appName,
      version: this.config.appVersion,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startupTime) / 1000),
      checks,
    };
  }
}
