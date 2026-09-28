import { loadServerConfig } from '@platform/config';
import { createDatabasePool, createDrizzleClient } from './client.js';
import { runMigrations } from './migrator.js';

async function main(): Promise<void> {
  const config = loadServerConfig();
  console.log(
    `[Migrator] Connecting to database: ${config.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`
  );

  const pool = createDatabasePool({
    databaseUrl: config.DATABASE_URL,
    databasePoolMin: 1,
    databasePoolMax: 2,
    databaseConnectionTimeoutMs: 5000,
    databaseIdleTimeoutMs: 10000,
    databaseStatementTimeoutMs: 30000,
    isProduction: config.NODE_ENV === 'production',
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

  const db = createDrizzleClient(pool);

  try {
    console.log('[Migrator] Applying pending migrations...');
    await runMigrations(db as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    console.log('[Migrator] All migrations successfully applied.');
  } catch (err: unknown) {
    console.error('[Migrator] Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
