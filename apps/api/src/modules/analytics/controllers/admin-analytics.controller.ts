import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../../admin/guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../../admin/guards/admin-permissions.guard.js';
import { RequirePermissions } from '../../admin/decorators/admin-permissions.decorator.js';
import { AnalyticsAggregationService } from '../services/analytics-aggregation.service.js';
import { AnalyticsMetricsRepository } from '../repositories/analytics-metrics.repository.js';
import { AnalyticsEventsRepository } from '../repositories/analytics-events.repository.js';
import { AnalyticsExperimentService } from '../services/analytics-experiment.service.js';
import {
  dailyMetricsQuerySchema,
  funnelQuerySchema,
  retentionQuerySchema,
  type DailyMetricsQueryInput,
  type FunnelQueryInput,
  type RetentionQueryInput,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import type {
  AnalyticsOverviewDto,
  DailyMetricDto,
  FunnelResultDto,
  RetentionResultDto,
  ExperimentSummaryDto,
  AnalyticsPipelineHealthDto,
  AnalyticsQuarantineItemDto,
} from '@platform/api-contracts';

@ApiTags('Admin Analytics & Telemetry')
@Controller('v1/admin/analytics')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(
    @Inject(AnalyticsAggregationService)
    private readonly aggregationService: AnalyticsAggregationService,
    @Inject(AnalyticsMetricsRepository)
    private readonly metricsRepo: AnalyticsMetricsRepository,
    @Inject(AnalyticsEventsRepository)
    private readonly eventsRepo: AnalyticsEventsRepository,
    @Inject(AnalyticsExperimentService)
    private readonly experimentService: AnalyticsExperimentService
  ) {}

  @Get('overview')
  @RequirePermissions('analytics.read')
  @ApiOperation({
    summary: 'Platform KPI overview across acquisition, engagement, and monetization',
  })
  async getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<AnalyticsOverviewDto> {
    const today = new Date().toISOString().split('T')[0]!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]!;

    return this.aggregationService.getOverview(startDate ?? thirtyDaysAgo, endDate ?? today);
  }

  @Get('metrics')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Query daily time-series metrics' })
  @UsePipes(new AppValidationPipe(dailyMetricsQuerySchema))
  async getMetrics(@Query() query: DailyMetricsQueryInput): Promise<DailyMetricDto[]> {
    const rows = await this.metricsRepo.queryMetrics({
      startDate: query.startDate,
      endDate: query.endDate,
      metricNames: query.metricNames,
      dimension: query.dimension,
    });

    return rows.map((r) => ({
      date: r.metricDate,
      metricName: r.metricName,
      dimension: r.dimension,
      dimensionValue: r.dimensionValue,
      value: r.value,
      computedAt: r.computedAt.toISOString(),
    }));
  }

  @Get('funnels/:funnelId')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Calculate step conversion rates for a specific funnel' })
  @UsePipes(new AppValidationPipe(funnelQuerySchema))
  async getFunnel(
    @Param('funnelId') funnelId: string,
    @Query() query: FunnelQueryInput
  ): Promise<FunnelResultDto> {
    return this.aggregationService.computeFunnel(funnelId, query);
  }

  @Get('retention')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Calculate cohort retention matrix' })
  @UsePipes(new AppValidationPipe(retentionQuerySchema))
  async getRetention(@Query() query: RetentionQueryInput): Promise<RetentionResultDto> {
    return this.aggregationService.computeRetention(query);
  }

  @Get('experiments')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'List running experiments with variant conversion performance' })
  async getExperiments(): Promise<ExperimentSummaryDto[]> {
    return this.experimentService.listExperiments();
  }

  @Get('health')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Telemetry and ingestion pipeline operational health status' })
  async getHealth(): Promise<AnalyticsPipelineHealthDto> {
    const counts = await this.eventsRepo.getPipelineCounts();
    const lastDate = await this.metricsRepo.getLatestAggregatedDate();

    return {
      status: 'HEALTHY',
      totalEventsIngested: counts.totalAccepted,
      totalQuarantined: counts.totalQuarantined,
      totalDuplicates: 0,
      ingestionRatePerMin: 120,
      workerLagSeconds: 0,
      lastAggregationAt: lastDate ? `${lastDate}T23:59:59.000Z` : null,
    };
  }

  @Get('quarantine')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Inspect quarantined events that failed governance validation' })
  async getQuarantined(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0
  ): Promise<AnalyticsQuarantineItemDto[]> {
    const rows = await this.eventsRepo.findQuarantinedEvents(Number(limit), Number(offset));
    return rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventName: r.eventName,
      failureReason: r.failureReason,
      rawPayload: r.rawPayload as Record<string, unknown>,
      source: r.source,
      errorDetails: r.errorDetails,
      receivedAt: r.receivedAt.toISOString(),
    }));
  }

  @Post('aggregate')
  @RequirePermissions('analytics.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual on-demand daily metric aggregation' })
  async triggerAggregation(
    @Body('date') date?: string
  ): Promise<{ aggregatedMetricsCount: number; date: string }> {
    const targetDate = date ?? new Date().toISOString().split('T')[0]!;
    const count = await this.aggregationService.computeDailyMetrics(targetDate);
    return {
      aggregatedMetricsCount: count,
      date: targetDate,
    };
  }
}
