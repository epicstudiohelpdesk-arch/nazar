import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { loadServerConfig } from '@platform/config';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppLoggerService } from './common/logging/app-logger.service.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AppValidationPipe } from './common/pipes/app-validation.pipe.js';
import { RedisIoAdapter } from './modules/chat/adapters/redis-io.adapter.js';
import { setupSwagger } from './swagger.js';

export async function bootstrap() {
  // 1. Load & Validate Environment (Fails fast if invalid)
  loadServerConfig();

  // 2. Create Nest Application
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(AppConfigService);
  const logger = app.get(AppLoggerService);

  // 3. Configure Custom Structured Logger
  app.useLogger(logger);

  // 4. Configure Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: configService.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xFrameOptions: { action: 'deny' },
      hsts: configService.isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    })
  );

  // 5. Configure Global Error Handling
  app.useGlobalFilters(new GlobalExceptionFilter(logger, configService));

  // 6. Configure Global Validation
  app.useGlobalPipes(new AppValidationPipe());

  // 6.5. Configure Redis WebSocket Adapter for Multi-Pod Clustering (SEC-02)
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // 7. Configure CORS
  const corsOrigin =
    configService.corsOrigin === '*'
      ? true
      : configService.corsOrigin.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'idempotency-key',
      'x-api-version',
      'x-device-id',
    ],
    exposedHeaders: ['x-request-id', 'x-idempotent-replayed'],
  });

  // 8. Configure OpenAPI / Swagger Documentation
  setupSwagger(app, configService);

  // 9. Register Graceful Shutdown Hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  // 10. Start Listening
  await app.listen(configService.port);
  logger.log(
    `[Nazar API] Application running on port ${configService.port} (${configService.nodeEnv})`,
    'Bootstrap'
  );

  return app;
}

// Start application if directly executed
if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err: unknown) => {
    console.error('[Nazar API] Fatal startup error:', err);
    process.exit(1);
  });
}
