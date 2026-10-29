import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { WorkerDaemonService } from './modules/workers/worker-daemon.service.js';
import { AppLoggerService } from './common/logging/app-logger.service.js';
import { AppConfigService } from './config/app-config.service.js';
import { loadServerConfig } from '@platform/config';

export async function bootstrapWorker() {
  loadServerConfig();

  // Create standalone application context (no HTTP listener)
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  const config = app.get(AppConfigService);
  app.useLogger(logger);

  logger.log(
    `[Nazar Worker] Initializing background worker daemon (${config.nodeEnv})...`,
    'WorkerBootstrap'
  );

  const daemon = app.get(WorkerDaemonService);

  const shutdown = async (signal: string) => {
    logger.log(
      `[Nazar Worker] Received ${signal}. Shutting down worker daemon...`,
      'WorkerBootstrap'
    );
    try {
      await daemon.stop();
      await app.close();
      logger.log('[Nazar Worker] Clean shutdown completed', 'WorkerBootstrap');
      process.exit(0);
    } catch (err: unknown) {
      logger.error(
        `[Nazar Worker] Error during shutdown: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'WorkerBootstrap'
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await daemon.start();
  logger.log(
    '[Nazar Worker] Background daemon active and processing queue events',
    'WorkerBootstrap'
  );
  return { app, daemon };
}

if (process.env.NODE_ENV !== 'test') {
  bootstrapWorker().catch((err: unknown) => {
    console.error('[Nazar Worker] Fatal startup failure:', err);
    process.exit(1);
  });
}
