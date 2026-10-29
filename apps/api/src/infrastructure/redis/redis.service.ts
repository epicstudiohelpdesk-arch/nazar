import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { AppConfigService } from '../../config/app-config.service.js';
import type { ICacheService } from '../cache/cache.interface.js';

@Injectable()
export class RedisService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService
  ) {
    this.initClient();
  }

  private initClient(): void {
    try {
      const options: RedisOptions = {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            return null; // Stop retrying after 5 attempts
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      };

      this.client = new Redis(this.config.redisUrl, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis server');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // In test mode, reduce error noise if redis is not running
        if (this.config.isTest) {
          this.logger.debug(`Redis connection warning: ${err.message}`);
        } else {
          this.logger.warn(`Redis connection error: ${err.message}`);
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Eagerly connect if not test environment
      if (!this.config.isTest) {
        this.client.connect().catch((err) => {
          this.logger.warn(`Initial Redis connection failed: ${err.message}`);
        });
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to initialize Redis client: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  getClient(): Redis | null {
    return this.client;
  }

  createClient(): Redis {
    return new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      if (!this.isConnected) {
        await this.client.connect().catch(() => {});
      }
      const raw = await this.client.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Redis GET error for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.isConnected) {
        await this.client.connect().catch(() => {});
      }
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Redis SET error for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.isConnected) {
        await this.client.connect().catch(() => {});
      }
      await this.client.del(key);
    } catch (err: unknown) {
      this.logger.warn(
        `Redis DEL error for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (!this.isConnected) {
        await this.client.connect().catch(() => {});
      }
      const count = await this.client.exists(key);
      return count > 0;
    } catch (err: unknown) {
      this.logger.warn(
        `Redis EXISTS error for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      this.isConnected = false;
    }
  }
}
