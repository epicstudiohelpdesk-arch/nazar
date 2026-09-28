import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import { AppLoggerService } from '../src/common/logging/app-logger.service.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { AppValidationPipe } from '../src/common/pipes/app-validation.pipe.js';
import { setupSwagger } from '../src/swagger.js';
import { TestRoutesController } from './test-routes.controller.js';

export async function createTestApp(): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestRoutesController],
  }).compile();

  const app = moduleRef.createNestApplication({
    bufferLogs: true,
  });

  const configService = app.get(AppConfigService);
  const logger = app.get(AppLoggerService);

  app.useLogger(logger);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger, configService));
  app.useGlobalPipes(new AppValidationPipe());

  const corsOrigin =
    configService.corsOrigin === '*'
      ? '*'
      : configService.corsOrigin.split(',').map((o) => o.trim());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'idempotency-key'],
    exposedHeaders: ['x-request-id', 'x-idempotent-replayed'],
  });

  setupSwagger(app, configService);
  app.enableShutdownHooks();

  await app.init();
  return { app, moduleRef };
}
