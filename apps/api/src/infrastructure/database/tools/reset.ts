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

  // Drop all public tables and migration metadata
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
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
