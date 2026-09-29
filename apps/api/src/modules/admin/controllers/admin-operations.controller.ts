import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard.js';
import { RequirePermissions } from '../decorators/admin-permissions.decorator.js';
import { AdminOperationsService } from '../services/admin-operations.service.js';
import type {
  AdminDashboardMetricsDto,
  AdminCommunitySummaryDto,
  AdminEventSummaryDto,
  AdminOutboxJobDto,
  AdminNotificationJobDto,
  AdminRecommendationDiagnosticsDto,
} from '@platform/api-contracts';

@ApiTags('Admin Operations & Diagnostics')
@Controller('v1/admin/operations')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminOperationsController {
  constructor(
    @Inject(AdminOperationsService)
    private readonly operationsService: AdminOperationsService
  ) {}

  @Get('dashboard')
  @RequirePermissions('health.read')
  @ApiOperation({ summary: 'Platform operational overview and KPI metrics' })
  async getDashboard(): Promise<{ metrics: AdminDashboardMetricsDto }> {
    const metrics = await this.operationsService.getDashboardMetrics();
    return { metrics };
  }

  @Get('communities')
  @RequirePermissions('communities.read')
  @ApiOperation({ summary: 'List communities across platform for operational oversight' })
  async getCommunities(): Promise<{ items: AdminCommunitySummaryDto[] }> {
    const items = await this.operationsService.getCommunities();
    return { items };
  }

  @Get('events')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'List platform events and attendance capacity' })
  async getEvents(): Promise<{ items: AdminEventSummaryDto[] }> {
    const items = await this.operationsService.getEvents();
    return { items };
  }

  @Get('jobs/outbox')
  @RequirePermissions('jobs.read')
  @ApiOperation({ summary: 'View transactional outbox events status and retries' })
  async getOutboxJobs(): Promise<{ items: AdminOutboxJobDto[] }> {
    const items = await this.operationsService.getOutboxJobs();
    return { items };
  }

  @Get('jobs/notifications')
  @RequirePermissions('jobs.read')
  @ApiOperation({ summary: 'View notification delivery queue and delivery failures' })
  async getNotificationJobs(): Promise<{ items: AdminNotificationJobDto[] }> {
    const items = await this.operationsService.getNotificationJobs();
    return { items };
  }

  @Get('recommendations/diagnostics')
  @RequirePermissions('recommendations.diagnostics.read')
  @ApiOperation({ summary: 'View recommendation engine model versions and exposure metrics' })
  async getRecommendationDiagnostics(): Promise<{
    diagnostics: AdminRecommendationDiagnosticsDto;
  }> {
    const diagnostics = await this.operationsService.getRecommendationDiagnostics();
    return { diagnostics };
  }
}
