import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service.js';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfigService
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    try {
      this.pubClient = new Redis(this.config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
      });
      this.subClient = this.pubClient.duplicate();

      this.pubClient.on('error', (err) => {
        if (!this.config.isTest) {
          this.logger.warn(`Redis pub client error: ${err.message}`);
        }
      });
      this.subClient.on('error', (err) => {
        if (!this.config.isTest) {
          this.logger.warn(`Redis sub client error: ${err.message}`);
        }
      });

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.logger.log('Redis WebSocket adapter successfully connected and initialized');
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to connect Redis WebSocket adapter (falling back to in-memory adapter): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      this.adapterConstructor = null;
    }
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Attached Redis Pub/Sub adapter to Socket.IO server');
    }
    return server;
  }

  override async close(server: any): Promise<void> {
    await super.close(server);
    if (this.pubClient) {
      try {
        await this.pubClient.quit();
      } catch {
        this.pubClient.disconnect();
      }
      this.pubClient = null;
    }
    if (this.subClient) {
      try {
        await this.subClient.quit();
      } catch {
        this.subClient.disconnect();
      }
      this.subClient = null;
    }
  }
}
