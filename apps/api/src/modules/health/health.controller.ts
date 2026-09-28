import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '@platform/api-contracts';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthCheckResponse {
    return this.healthService.check();
  }
}
