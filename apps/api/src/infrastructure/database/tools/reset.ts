import { loadServerConfig } from '@platform/config';
import { sql } from 'drizzle-orm';
import { createDatabasePool, createDrizzleClient } from '../drizzle/client.js';
import { runMigrations } from '../drizzle/migrator.js';
import { seedDatabase } from '../seeds/seed.js';

export async function resetDatabase(
  db: ReturnType<typeof createDrizzleClient>,
  env: string,
  shouldSeed = true
): Promise<void> {
  if (env === 'production') {
    throw new Error('FATAL: Database reset is strictly prohibited in production!');
  }

  console.log(`[Reset] Resetting database in ${env} environment...`);

  // Drop foundational tables in correct dependency order
  await db.execute(sql`
    DROP TABLE IF EXISTS "security_events" CASCADE;
    DROP TABLE IF EXISTS "audit_logs" CASCADE;
    DROP TABLE IF EXISTS "outbox_events" CASCADE;
    DROP TABLE IF EXISTS "idempotency_keys" CASCADE;
    DROP TABLE IF EXISTS "sessions" CASCADE;
    DROP TABLE IF EXISTS "devices" CASCADE;
    DROP TABLE IF EXISTS "users" CASCADE;
    DROP SCHEMA IF EXISTS "drizzle" CASCADE;
    DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;
  `);

  console.log('[Reset] Tables successfully dropped. Applying migrations...');
  await runMigrations(db as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  console.log('[Reset] Migrations applied cleanly.');

  if (shouldSeed) {
    await seedDatabase(db, env);
  }
}

async function main(): Promise<void> {
  const config = loadServerConfig();

  if (config.NODE_ENV === 'production') {
    console.error('FATAL: Database reset is strictly prohibited in production!');
    process.exit(1);
  }

  const pool = createDatabasePool({
    databaseUrl: config.DATABASE_URL,
    databasePoolMin: 1,
    databasePoolMax: 2,
    databaseConnectionTimeoutMs: 5000,
    databaseIdleTimeoutMs: 10000,
    databaseStatementTimeoutMs: 30000,
    isProduction: false,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

  const db = createDrizzleClient(pool);

  try {
    await resetDatabase(db, config.NODE_ENV, true);
    console.log('[Reset] Database reset and reseeded successfully.');
  } catch (err: unknown) {
    console.error('[Reset] Failed to reset database:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('reset.ts') || process.argv[1]?.endsWith('reset.js')) {
  main();
}
