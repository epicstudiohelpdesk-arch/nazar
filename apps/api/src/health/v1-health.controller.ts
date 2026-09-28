import { Controller, Get, Res, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@platform/api-contracts';
import { HealthService } from './health.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('System & Observability')
@Controller('v1')
export class V1HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Versioned Liveness Endpoint',
    description: 'Returns service liveness under the canonical /v1 namespace.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Liveness status' })
  getLiveness(): HealthCheckResponse {
    return this.healthService.checkLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Versioned Readiness Endpoint',
    description: 'Returns service readiness under the canonical /v1 namespace.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Readiness status' })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessCheckResponse> {
    const result = await this.healthService.checkReadiness();
    if (result.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
