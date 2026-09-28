import { Global, Module } from '@nestjs/common';
import pg from 'pg';
import { AppConfigModule } from '../../config/app-config.module.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppLoggerModule } from '../../common/logging/app-logger.module.js';
import { createDatabasePool, createDrizzleClient } from './drizzle/client.js';
import { DatabaseService } from './database.service.js';
import {
  DATABASE_POOL_TOKEN,
  DATABASE_CONNECTION_TOKEN,
  DATABASE_SERVICE_TOKEN,
} from './database.tokens.js';
import { DatabaseHealthIndicator } from './health/database-health.indicator.js';
import { PostgresIdempotencyStore } from './repositories/postgres-idempotency.store.js';
import { UserRepository, USER_REPOSITORY_TOKEN } from './repositories/user.repository.js';

@Global()
@Module({
  imports: [AppConfigModule, AppLoggerModule],
  providers: [
    {
      provide: DATABASE_POOL_TOKEN,
      useFactory: (config: AppConfigService): pg.Pool => {
        return createDatabasePool(config);
      },
      inject: [AppConfigService],
    },
    {
      provide: DATABASE_CONNECTION_TOKEN,
      useFactory: (pool: pg.Pool) => {
        return createDrizzleClient(pool);
      },
      inject: [DATABASE_POOL_TOKEN],
    },
    DatabaseService,
    {
      provide: DATABASE_SERVICE_TOKEN,
      useExisting: DatabaseService,
    },
    DatabaseHealthIndicator,
    PostgresIdempotencyStore,
    UserRepository,
    {
      provide: USER_REPOSITORY_TOKEN,
      useExisting: UserRepository,
    },
  ],
  exports: [
    DATABASE_POOL_TOKEN,
    DATABASE_CONNECTION_TOKEN,
    DATABASE_SERVICE_TOKEN,
    DatabaseService,
    DatabaseHealthIndicator,
    PostgresIdempotencyStore,
    UserRepository,
    USER_REPOSITORY_TOKEN,
  ],
})
export class DatabaseModule {}
