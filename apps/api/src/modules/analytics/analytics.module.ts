import { Module, Inject, type OnModuleInit } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller.js';
import { EventGovernanceService } from './services/event-governance.service.js';
import { AnalyticsEventsRepository } from './repositories/analytics-events.repository.js';
import { AnalyticsMetricsRepository } from './repositories/analytics-metrics.repository.js';
import { AnalyticsIngestionService } from './services/analytics-ingestion.service.js';
import { AnalyticsAggregationService } from './services/analytics-aggregation.service.js';
import { AnalyticsExperimentService } from './services/analytics-experiment.service.js';
import { AdminModule } from '../admin/admin.module.js';

@Module({
  imports: [AdminModule],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [
    EventGovernanceService,
    AnalyticsEventsRepository,
    AnalyticsMetricsRepository,
    AnalyticsIngestionService,
    AnalyticsAggregationService,
    AnalyticsExperimentService,
  ],
  exports: [
    EventGovernanceService,
    AnalyticsEventsRepository,
    AnalyticsMetricsRepository,
    AnalyticsIngestionService,
    AnalyticsAggregationService,
    AnalyticsExperimentService,
  ],
})
export class AnalyticsModule implements OnModuleInit {
  constructor(
    @Inject(AnalyticsExperimentService)
    private readonly experimentService: AnalyticsExperimentService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.experimentService) {
        await this.experimentService.ensureStandardExperiments();
      }
    } catch (err: unknown) {
      console.warn('[AnalyticsModule] Experiment bootstrap notice:', (err as Error).message);
    }
  }
}
