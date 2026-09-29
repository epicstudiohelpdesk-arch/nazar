import { loadServerConfig } from '@platform/config';
import { createDatabasePool, createDrizzleClient } from '../drizzle/client.js';
import { seedPerfDataset } from '../seeds/perf-seed.js';

async function main(): Promise<void> {
  const config = loadServerConfig();
  console.log('[PerfSeed] Connecting to database...');

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
    console.log('[PerfSeed] Starting synthetic performance dataset generation...');
    const startTime = Date.now();
    const result = await seedPerfDataset(db);
    const durationMs = Date.now() - startTime;

    console.log('---------------------------------------------------------');
    console.log(`[PerfSeed] Synthetic performance dataset successfully created in ${durationMs}ms`);
    console.log(`- Total Users:         ${result.totalUsers}`);
    console.log(`- London Users:        ${result.userMapByCluster['London']?.length ?? 0}`);
    console.log(`- Istanbul Users:      ${result.userMapByCluster['Istanbul']?.length ?? 0}`);
    console.log(`- New York Users:      ${result.userMapByCluster['NewYork']?.length ?? 0}`);
    console.log(`- Matches:             ${result.matchIds.length}`);
    console.log(`- Conversations:       ${result.conversationIds.length}`);
    console.log(`- Communities:         ${result.communityIds.length}`);
    console.log(`- Events:              ${result.eventIds.length}`);
    console.log('---------------------------------------------------------');
  } catch (err: unknown) {
    console.error('[PerfSeed] Failed to seed performance dataset:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
