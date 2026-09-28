import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import type { AppConfigService } from '../../../config/app-config.service.js';

const { Pool } = pg;

export type DrizzleDatabase = NodePgDatabase<typeof schema>;

export function createDatabasePool(config: AppConfigService): pg.Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    min: config.databasePoolMin,
    max: config.databasePoolMax,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    statement_timeout: config.databaseStatementTimeoutMs,
    ssl: config.isProduction ? { rejectUnauthorized: true } : false,
  });

  return pool;
}

export function createDrizzleClient(pool: pg.Pool): DrizzleDatabase {
  return drizzle(pool, { schema });
}
