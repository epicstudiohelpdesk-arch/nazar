import { Module } from '@nestjs/common';
import { WorkerDaemonService } from './worker-daemon.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AppConfigModule } from '../../config/app-config.module.js';
import { AppLoggerModule } from '../../common/logging/app-logger.module.js';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    InfrastructureModule,
    NotificationsModule,
    PaymentsModule,
    RecommendationsModule,
  ],
  providers: [WorkerDaemonService],
  exports: [WorkerDaemonService],
})
export class WorkersModule {}
