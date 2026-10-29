import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisService } from '../src/infrastructure/redis/redis.service.js';
import { RedisThrottlerStorage } from '../src/infrastructure/redis/redis-throttler-storage.js';
import type { AppConfigService } from '../src/config/app-config.service.js';

describe('SEC-02: Redis Distributed Cache, Socket.IO & Rate Limiter Storage', () => {
  let redisService: RedisService;
  let throttlerStorage: RedisThrottlerStorage;

  const mockConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://:nazar_redis_password@localhost:6379/0',
    isTest: false,
    rateLimitTtlMs: 60000,
    rateLimitLimit: 10,
  } as unknown as AppConfigService;

  beforeAll(async () => {
    redisService = new RedisService(mockConfig);
    throttlerStorage = new RedisThrottlerStorage(redisService);
    // Wait for connection
    const client = redisService.getClient();
    if (client) {
      await client.connect().catch(() => {});
    }
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
  });

  describe('RedisService (ICacheService implementation)', () => {
    it('sets, gets, and serializes JSON objects correctly', async () => {
      const testKey = `test:cache:json:${Date.now()}`;
      const payload = { userId: 'usr_123', plan: 'PREMIUM', active: true };

      await redisService.set(testKey, payload, 30);
      const retrieved = await redisService.get<typeof payload>(testKey);

      expect(retrieved).toEqual(payload);
      expect(await redisService.has(testKey)).toBe(true);

      await redisService.delete(testKey);
      expect(await redisService.has(testKey)).toBe(false);
      expect(await redisService.get(testKey)).toBeNull();
    });

    it('sets key with TTL and verifies expiration in Redis', async () => {
      const testKey = `test:cache:ttl:${Date.now()}`;
      await redisService.set(testKey, 'ephemeral', 1); // 1 second TTL

      expect(await redisService.get(testKey)).toBe('ephemeral');

      // Wait for TTL expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(await redisService.get(testKey)).toBeNull();
    });

    it('creates duplicate clients for Socket.IO Pub/Sub adapter', async () => {
      const pubClient = redisService.createClient();
      expect(pubClient).toBeDefined();

      const pingResult = await pubClient.ping();
      expect(pingResult).toBe('PONG');
      await pubClient.quit();
    });
  });

  describe('RedisThrottlerStorage (Distributed Atomic Throttling)', () => {
    it('atomically tracks hits across requests', async () => {
      const throttleKey = `user_ip_${Date.now()}`;
      const ttlMs = 10000;
      const limit = 5;

      const record1 = await throttlerStorage.increment(throttleKey, ttlMs, limit, 0, 'default');
      expect(record1.totalHits).toBe(1);
      expect(record1.isBlocked).toBe(false);

      const record2 = await throttlerStorage.increment(throttleKey, ttlMs, limit, 0, 'default');
      expect(record2.totalHits).toBe(2);
      expect(record2.isBlocked).toBe(false);
    });

    it('blocks requests and sets block duration when limit is exceeded', async () => {
      const throttleKey = `blocked_ip_${Date.now()}`;
      const ttlMs = 5000;
      const limit = 3;
      const blockDurationMs = 2000;

      // 3 allowed hits
      await throttlerStorage.increment(throttleKey, ttlMs, limit, blockDurationMs, 'default');
      await throttlerStorage.increment(throttleKey, ttlMs, limit, blockDurationMs, 'default');
      const rec3 = await throttlerStorage.increment(
        throttleKey,
        ttlMs,
        limit,
        blockDurationMs,
        'default'
      );
      expect(rec3.totalHits).toBe(3);
      expect(rec3.isBlocked).toBe(false);

      // 4th hit exceeds limit -> enters blocked state
      const rec4 = await throttlerStorage.increment(
        throttleKey,
        ttlMs,
        limit,
        blockDurationMs,
        'default'
      );
      expect(rec4.totalHits).toBe(4);
      expect(rec4.isBlocked).toBe(true);
      expect(rec4.timeToBlockExpire).toBeGreaterThan(0);

      // 5th hit while blocked -> still blocked
      const rec5 = await throttlerStorage.increment(
        throttleKey,
        ttlMs,
        limit,
        blockDurationMs,
        'default'
      );
      expect(rec5.isBlocked).toBe(true);
    });

    it('aggregates hits from concurrent instances hitting the same key (anti-clustering bypass)', async () => {
      const sharedKey = `cluster_ip_${Date.now()}`;
      const ttlMs = 10000;
      const limit = 20;

      // Simulate 10 concurrent requests from different API pods/instances
      const promises = Array.from({ length: 10 }).map(() =>
        throttlerStorage.increment(sharedKey, ttlMs, limit, 0, 'default')
      );

      const results = await Promise.all(promises);
      const hitCounts = results.map((r) => r.totalHits).sort((a, b) => a - b);

      // Max hit count should be exactly 10, proving all 10 were atomically aggregated
      expect(Math.max(...hitCounts)).toBe(10);
    });

    it('falls back to in-memory tracking cleanly when Redis is not available', async () => {
      const mockDisconnectedRedisService = {
        getClient: () => null,
      } as unknown as RedisService;

      const fallbackStorage = new RedisThrottlerStorage(mockDisconnectedRedisService);
      const key = `fallback_key_${Date.now()}`;

      const rec1 = await fallbackStorage.increment(key, 5000, 2, 1000, 'default');
      expect(rec1.totalHits).toBe(1);
      expect(rec1.isBlocked).toBe(false);

      const rec2 = await fallbackStorage.increment(key, 5000, 2, 1000, 'default');
      expect(rec2.totalHits).toBe(2);

      const rec3 = await fallbackStorage.increment(key, 5000, 2, 1000, 'default');
      expect(rec3.totalHits).toBe(3);
      expect(rec3.isBlocked).toBe(true);
    });
  });
});
