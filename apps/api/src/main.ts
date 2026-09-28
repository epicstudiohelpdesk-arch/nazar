import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadServerConfig } from '@platform/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const config = loadServerConfig();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.listen(config.PORT);
  console.log(`[Nazar API] Application running on port ${config.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error('[Nazar API] Fatal startup error:', err);
  process.exit(1);
});
