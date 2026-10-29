import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { RedisThrottlerStorage } from './redis-throttler-storage.js';
import { CACHE_SERVICE_TOKEN } from '../cache/cache.interface.js';
import { REDIS_SERVICE_TOKEN, REDIS_THROTTLER_STORAGE_TOKEN } from './redis.tokens.js';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: REDIS_SERVICE_TOKEN,
      useExisting: RedisService,
    },
    {
      provide: CACHE_SERVICE_TOKEN,
      useExisting: RedisService,
    },
    RedisThrottlerStorage,
    {
      provide: REDIS_THROTTLER_STORAGE_TOKEN,
      useExisting: RedisThrottlerStorage,
    },
  ],
  exports: [
    RedisService,
    REDIS_SERVICE_TOKEN,
    CACHE_SERVICE_TOKEN,
    RedisThrottlerStorage,
    REDIS_THROTTLER_STORAGE_TOKEN,
  ],
})
export class RedisModule {}
