import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { V1HealthController } from './v1-health.controller.js';
import { HealthService } from './health.service.js';
import { HEALTH_INDICATOR_TOKEN } from './indicators/health-indicator.interface.js';
import { ProcessHealthIndicator } from './indicators/process-health.indicator.js';

@Module({
  controllers: [HealthController, V1HealthController],
  providers: [
    HealthService,
    ProcessHealthIndicator,
    {
      provide: HEALTH_INDICATOR_TOKEN,
      useFactory: (processIndicator: ProcessHealthIndicator) => [processIndicator],
      inject: [ProcessHealthIndicator],
    },
  ],
  exports: [HealthService],
})
export class HealthModule {}
