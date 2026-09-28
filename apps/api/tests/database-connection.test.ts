import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { createTestApp } from './test-app.helper.js';
import {
  DATABASE_SERVICE_TOKEN,
  DATABASE_POOL_TOKEN,
} from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';

describe('Database Connection and Pool Foundation', () => {
  let app: INestApplication;
  let dbService: DatabaseService;
  let pool: pg.Pool;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    dbService = app.get<DatabaseService>(DATABASE_SERVICE_TOKEN);
    pool = app.get<pg.Pool>(DATABASE_POOL_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should acquire client from connection pool and release cleanly', async () => {
    const client = await pool.connect();
    expect(client).toBeDefined();

    const result = await client.query('SELECT 1 as result');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].result).toBe(1);

    client.release();
  });

  it('should verify connection pool configuration parameters', () => {
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    expect(pool.options.max).toBeDefined();
    expect(pool.options.connectionTimeoutMillis).toBeDefined();
    expect(pool.options.idleTimeoutMillis).toBeDefined();
  });

  it('should execute raw query and record low latency', async () => {
    const start = performance.now();
    const result = await pool.query('SELECT NOW() as current_time');
    const duration = performance.now() - start;

    expect(result.rows[0].current_time).toBeDefined();
    expect(duration).toBeLessThan(100);
  });

  it('should return healthy status from database healthCheck', async () => {
    const isHealthy = await dbService.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('should execute typed query via Drizzle ORM instance', async () => {
    const drizzle = dbService.drizzle;
    const result = await drizzle.execute(sql`SELECT 42 as answer`);

    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0].answer)).toBe(42);
  });
});
