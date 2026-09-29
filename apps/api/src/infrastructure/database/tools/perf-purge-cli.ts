import { loadServerConfig } from '@platform/config';
import { createDatabasePool, createDrizzleClient } from '../drizzle/client.js';
import { purgePerfDataset } from '../seeds/perf-seed.js';

async function main(): Promise<void> {
  const config = loadServerConfig();
  console.log('[PerfPurge] Connecting to database...');

  const pool = createDatabasePool({
    databaseUrl: config.DATABASE_URL,
    databasePoolMin: 2,
    databasePoolMax: 10,
    databaseConnectionTimeoutMs: 5000,
    databaseIdleTimeoutMs: 10000,
    databaseStatementTimeoutMs: 30000,
    isProduction: config.NODE_ENV === 'production',
  } as any);

  const db = createDrizzleClient(pool);

  try {
    console.log('[PerfPurge] Purging synthetic performance dataset...');
    const startTime = Date.now();
    const result = await purgePerfDataset(db);
    const durationMs = Date.now() - startTime;

    console.log('---------------------------------------------------------');
    console.log(`[PerfPurge] Performance dataset purged cleanly in ${durationMs}ms`);
    console.log(`- Deleted Users:       ${result.deletedUsers}`);
    console.log(`- Deleted Analytics:   ${result.deletedAnalytics}`);
    console.log('---------------------------------------------------------');
  } catch (err: unknown) {
    console.error('[PerfPurge] Failed to purge performance dataset:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
