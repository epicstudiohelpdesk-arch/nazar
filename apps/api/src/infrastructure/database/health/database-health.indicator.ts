import { Injectable, Inject } from '@nestjs/common';
import type { ReadinessIndicatorResult } from '@platform/api-contracts';
import type { HealthIndicator } from '../../../health/indicators/health-indicator.interface.js';
import { DatabaseService } from '../database.service.js';

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async check(): Promise<ReadinessIndicatorResult> {
    const isHealthy = await this.databaseService.healthCheck();

    if (isHealthy) {
      return {
        status: 'healthy',
        message: 'PostgreSQL connection operational',
      };
    }

    return {
      status: 'unhealthy',
      message: 'PostgreSQL connection check failed',
    };
  }
}
