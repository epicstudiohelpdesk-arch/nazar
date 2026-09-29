import { Module, type NestModule, type MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { RequestContextModule } from './common/context/request-context.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AppLoggerModule } from './common/logging/app-logger.module.js';
import { LoggingInterceptor } from './common/logging/logging.interceptor.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js';
import { HealthModule } from './health/health.module.js';

// Domain Module Boundaries (Placeholders for future gates)
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { InteractionsModule } from './modules/interactions/interactions.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { SocialModule } from './modules/social/social.module.js';
import { RecommendationsModule } from './modules/recommendations/recommendations.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';

import { AuthGuard } from './common/guards/auth.guard.js';

@Module({
  imports: [
    AppConfigModule,
    RequestContextModule,
    AppLoggerModule,
    InfrastructureModule,
    HealthModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          ttl: config.rateLimitTtlMs,
          limit: config.rateLimitLimit,
        },
      ],
    }),
    // Domain modules
    AuthModule,
    UsersModule,
    ProfilesModule,
    DiscoveryModule,
    InteractionsModule,
    MatchesModule,
    ChatModule,
    SafetyModule,
    NotificationsModule,
    PaymentsModule,
    SocialModule,
    RecommendationsModule,
    AdminModule,
    AnalyticsModule,
    ComplianceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
