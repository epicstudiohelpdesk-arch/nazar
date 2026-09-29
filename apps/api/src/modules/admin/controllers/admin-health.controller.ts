import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard.js';
import { RequirePermissions } from '../decorators/admin-permissions.decorator.js';
import { AdminHealthService } from '../services/admin-health.service.js';
import type { AdminSystemHealthDto } from '@platform/api-contracts';

@ApiTags('Admin Operations & Diagnostics')
@Controller('v1/admin/system')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminHealthController {
  constructor(
    @Inject(AdminHealthService)
    private readonly healthService: AdminHealthService
  ) {}

  @Get('health')
  @RequirePermissions('health.read')
  @ApiOperation({ summary: 'Detailed internal system health and infrastructure latency' })
  async getHealth(): Promise<{ health: AdminSystemHealthDto }> {
    const health = await this.healthService.getSystemHealth();
    return { health };
  }
}
