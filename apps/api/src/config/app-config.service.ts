import { Injectable } from '@nestjs/common';
import { loadServerConfig, type ServerEnv } from '@platform/config';

@Injectable()
export class AppConfigService {
  private readonly env: ServerEnv;

  constructor() {
    this.env = loadServerConfig();
  }

  get config(): ServerEnv {
    return this.env;
  }

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get port(): number {
    return this.env.PORT;
  }

  get apiPrefix(): string {
    return this.env.API_PREFIX;
  }

  get corsOrigin(): string {
    return this.env.CORS_ORIGIN;
  }

  get logLevel(): string {
    return this.env.LOG_LEVEL;
  }

  get appName(): string {
    return this.env.APP_NAME;
  }

  get appVersion(): string {
    return this.env.APP_VERSION;
  }

  get rateLimitTtlMs(): number {
    return this.env.RATE_LIMIT_TTL_MS;
  }

  get rateLimitLimit(): number {
    return this.env.RATE_LIMIT_LIMIT;
  }
}
