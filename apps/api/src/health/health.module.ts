import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { V1HealthController } from './v1-health.controller.js';
import { HealthService } from './health.service.js';
import { HEALTH_INDICATOR_TOKEN } from './indicators/health-indicator.interface.js';
import { ProcessHealthIndicator } from './indicators/process-health.indicator.js';
import { DatabaseModule } from '../infrastructure/database/database.module.js';
import { DatabaseHealthIndicator } from '../infrastructure/database/health/database-health.indicator.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, V1HealthController],
  providers: [
    HealthService,
    ProcessHealthIndicator,
    {
      provide: HEALTH_INDICATOR_TOKEN,
      useFactory: (
        processIndicator: ProcessHealthIndicator,
        dbIndicator: DatabaseHealthIndicator
      ) => [processIndicator, dbIndicator],
      inject: [ProcessHealthIndicator, DatabaseHealthIndicator],
    },
  ],
  exports: [HealthService],
})
export class HealthModule {}
