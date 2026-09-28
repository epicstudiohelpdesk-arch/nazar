import { Injectable } from '@nestjs/common';
import type { ReadinessIndicatorResult } from '@platform/api-contracts';
import type { HealthIndicator } from './health-indicator.interface.js';

@Injectable()
export class ProcessHealthIndicator implements HealthIndicator {
  readonly name = 'process';

  async check(): Promise<ReadinessIndicatorResult> {
    const memory = process.memoryUsage();
    // 1.5GB threshold for heap limit alert
    const isDegraded = memory.heapUsed > 1.5 * 1024 * 1024 * 1024;

    return {
      status: isDegraded ? 'degraded' : 'healthy',
      message: isDegraded
        ? `High heap memory usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`
        : 'Process memory and runtime operational',
    };
  }
}
