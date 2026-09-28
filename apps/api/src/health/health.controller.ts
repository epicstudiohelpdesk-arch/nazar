import { Controller, Get, Res, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@platform/api-contracts';
import { HealthService } from './health.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('System & Observability')
@Controller()
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Process Liveness Probe',
    description: 'Verifies the process is alive and responsive (Kubernetes liveness probe).',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Process is alive and functioning',
  })
  getLiveness(): HealthCheckResponse {
    return this.healthService.checkLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Process Readiness Probe',
    description: 'Evaluates whether all system indicators report readiness to serve user traffic.',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'All system indicators report readiness',
  })
  @SwaggerApiResponse({
    status: 503,
    description: 'One or more subsystem indicators report unhealthy',
  })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessCheckResponse> {
    const result = await this.healthService.checkReadiness();
    if (result.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
