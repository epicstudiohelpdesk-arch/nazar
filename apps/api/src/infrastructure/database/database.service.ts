import { Injectable, Inject, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import { sql } from 'drizzle-orm';
import type { DrizzleDatabase } from './drizzle/client.js';
export type { DrizzleDatabase } from './drizzle/client.js';
import type { IDatabaseService, IUnitOfWork } from './database.interface.js';
import { DATABASE_POOL_TOKEN, DATABASE_CONNECTION_TOKEN } from './database.tokens.js';
import { AppLoggerService } from '../../common/logging/app-logger.service.js';
import { DrizzleTransactionManager } from './transaction.js';

@Injectable()
export class DatabaseService implements IDatabaseService, OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_POOL_TOKEN)
    private readonly dbPool: pg.Pool,
    @Inject(DATABASE_CONNECTION_TOKEN)
    private readonly db: DrizzleDatabase,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  get isConnected(): boolean {
    return !this.dbPool.ended;
  }

  get client(): DrizzleDatabase {
    return this.db;
  }

  get drizzle(): DrizzleDatabase {
    return this.db;
  }

  get rawPool(): pg.Pool {
    return this.dbPool;
  }

  get pool(): pg.Pool {
    return this.dbPool;
  }

  get transactionManager(): DrizzleTransactionManager {
    return new DrizzleTransactionManager(this.db);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.db.execute(sql`SELECT 1 as alive;`);
      return Array.isArray(res) || (res && 'rows' in res);
    } catch (err: unknown) {
      this.logger.warn(
        `Database health check failed: ${err instanceof Error ? err.message : String(err)}`,
        'DatabaseService'
      );
      return false;
    }
  }

  async withTransaction<T>(fn: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx: any) => {
      return fn(tx as unknown as DrizzleDatabase);
    });
  }

  async createUnitOfWork(): Promise<IUnitOfWork> {
    const client = await this.dbPool.connect();
    let inTransaction = false;

    return {
      start: async () => {
        await client.query('BEGIN');
        inTransaction = true;
      },
      commit: async () => {
        try {
          if (inTransaction) {
            await client.query('COMMIT');
            inTransaction = false;
          }
        } finally {
          client.release();
        }
      },
      rollback: async () => {
        try {
          if (inTransaction) {
            await client.query('ROLLBACK');
            inTransaction = false;
          }
        } finally {
          client.release();
        }
      },
    };
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Closing database pool on signal ${signal ?? 'SHUTDOWN'}...`,
      'DatabaseService'
    );
    try {
      await this.dbPool.end();
      this.logger.log('Database pool successfully drained and closed.', 'DatabaseService');
    } catch (err: unknown) {
      this.logger.error(
        `Error during database pool shutdown: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'DatabaseService'
      );
    }
  }
}
