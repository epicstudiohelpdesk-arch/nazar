import { loadServerConfig } from '@platform/config';
import { eq } from 'drizzle-orm';
import { createDatabasePool, createDrizzleClient } from '../drizzle/client.js';
import { users } from '../drizzle/schema/users.js';
import { devices } from '../drizzle/schema/devices.js';

export const SEED_TEST_USER_ID = '018f0000-0000-7000-8000-000000000001';
export const SEED_TEST_DEVICE_ID = '018f0000-0000-7000-8000-000000000002';

export async function seedDatabase(
  db: ReturnType<typeof createDrizzleClient>,
  env: string
): Promise<void> {
  if (env === 'production') {
    throw new Error('FATAL: Database seeding is strictly forbidden in production environments.');
  }

  console.log(`[Seed] Seeding foundational development data (environment: ${env})...`);

  // Ensure deterministic test user exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, SEED_TEST_USER_ID))
    .limit(1);

  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: SEED_TEST_USER_ID,
      status: 'ACTIVE',
    });
    console.log(`[Seed] Created foundational test user: ${SEED_TEST_USER_ID}`);
  }

  // Ensure deterministic test device exists
  const existingDevice = await db
    .select()
    .from(devices)
    .where(eq(devices.id, SEED_TEST_DEVICE_ID))
    .limit(1);

  if (existingDevice.length === 0) {
    await db.insert(devices).values({
      id: SEED_TEST_DEVICE_ID,
      userId: SEED_TEST_USER_ID,
      platform: 'ios',
      deviceModel: 'iPhone 15 Pro',
      appVersion: '0.1.0',
    });
    console.log(`[Seed] Created foundational test device: ${SEED_TEST_DEVICE_ID}`);
  }

  console.log('[Seed] Seeding completed successfully.');
}

async function main(): Promise<void> {
  const config = loadServerConfig();
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
    await seedDatabase(db, config.NODE_ENV);
  } catch (err: unknown) {
    console.error('[Seed] Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  main();
}
