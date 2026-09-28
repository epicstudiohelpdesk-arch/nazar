import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { PostgresIdempotencyStore } from './database/repositories/postgres-idempotency.store.js';
import { CLOCK_TOKEN } from './time/clock.interface.js';
import { SystemClock } from './time/system-clock.service.js';
import { ID_GENERATOR_TOKEN } from './id/id-generator.interface.js';
import { UuidV7Generator } from './id/uuidv7-generator.service.js';
import { IDEMPOTENCY_STORE_TOKEN } from '../common/idempotency/idempotency.interface.js';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    SystemClock,
    {
      provide: CLOCK_TOKEN,
      useExisting: SystemClock,
    },
    UuidV7Generator,
    {
      provide: ID_GENERATOR_TOKEN,
      useExisting: UuidV7Generator,
    },
    {
      provide: IDEMPOTENCY_STORE_TOKEN,
      useExisting: PostgresIdempotencyStore,
    },
    IdempotencyInterceptor,
  ],
  exports: [
    DatabaseModule,
    CLOCK_TOKEN,
    ID_GENERATOR_TOKEN,
    IDEMPOTENCY_STORE_TOKEN,
    IdempotencyInterceptor,
    SystemClock,
    UuidV7Generator,
  ],
})
export class InfrastructureModule {}
