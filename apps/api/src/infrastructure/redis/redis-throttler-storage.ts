import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import { RedisService } from './redis.service.js';

interface MemoryRecord {
  totalHits: number;
  expiresAt: number;
  blockedUntil?: number;
}

const THROTTLE_LUA_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDurationMs = tonumber(ARGV[3])

local isBlocked = redis.call('EXISTS', blockKey)
if isBlocked == 1 then
  local timeToBlockExpire = redis.call('PTTL', blockKey)
  local hits = tonumber(redis.call('GET', hitsKey) or limit)
  return { hits, 0, 1, math.max(0, timeToBlockExpire) }
end

local totalHits = redis.call('INCR', hitsKey)
if totalHits == 1 then
  redis.call('PEXPIRE', hitsKey, ttlMs)
end

local timeToExpire = redis.call('PTTL', hitsKey)

if totalHits > limit and blockDurationMs > 0 then
  redis.call('SET', blockKey, '1', 'PX', blockDurationMs)
  return { totalHits, math.max(0, timeToExpire), 1, blockDurationMs }
end

return { totalHits, math.max(0, timeToExpire), 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memoryFallback = new Map<string, MemoryRecord>();

  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getClient();

    if (client) {
      try {
        const hitsKey = `nazar:throttle:${throttlerName}:${key}`;
        const blockKey = `nazar:throttle:${throttlerName}:${key}:blocked`;

        const result = (await client.eval(
          THROTTLE_LUA_SCRIPT,
          2,
          hitsKey,
          blockKey,
          ttl,
          limit,
          blockDuration
        )) as [number, number, number, number];

        return {
          totalHits: Number(result[0]),
          timeToExpire: Math.max(0, Math.ceil(Number(result[1]) / 1000)),
          isBlocked: Number(result[2]) === 1,
          timeToBlockExpire: Math.max(0, Math.ceil(Number(result[3]) / 1000)),
        };
      } catch (err: unknown) {
        this.logger.debug(
          `Redis throttler eval error, falling back to in-memory: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // In-memory fallback
    return this.incrementMemory(key, ttl, limit, blockDuration);
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number
  ): ThrottlerStorageRecord {
    const now = Date.now();
    let record = this.memoryFallback.get(key);

    if (record && record.blockedUntil && record.blockedUntil > now) {
      return {
        totalHits: record.totalHits,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil((record.blockedUntil - now) / 1000),
      };
    }

    if (!record || record.expiresAt <= now) {
      record = {
        totalHits: 0,
        expiresAt: now + ttl,
      };
      this.memoryFallback.set(key, record);
    }

    record.totalHits++;
    const isBlocked = record.totalHits > limit && blockDuration > 0;
    if (isBlocked) {
      record.blockedUntil = now + blockDuration;
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }
}
