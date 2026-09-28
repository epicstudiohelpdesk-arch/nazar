import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfigService } from './config/app-config.service.js';

export function setupSwagger(app: INestApplication, config: AppConfigService): void {
  const documentConfig = new DocumentBuilder()
    .setTitle('Nazar Platform API')
    .setDescription(
      'Authoritative backend REST specification for the Nazar Dating & Social Discovery Platform. Mobile and Admin clients interact exclusively through these versioned endpoints.'
    )
    .setVersion(config.appVersion)
    .addServer(
      config.isDevelopment ? `http://localhost:${config.port}` : '/',
      `${config.nodeEnv.toUpperCase()} Server`
    )
    .addTag('System & Observability', 'Process liveness, readiness, and runtime telemetry probes')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Rotating JWT Access Token for authenticated user sessions',
      },
      'jwt-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'idempotency-key',
        in: 'header',
        description: 'UUIDv7 idempotency key ensuring safe retry semantics on mutations',
      },
      'idempotency-key'
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Nazar API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
