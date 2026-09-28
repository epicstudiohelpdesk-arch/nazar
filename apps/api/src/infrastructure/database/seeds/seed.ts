import { loadServerConfig } from '@platform/config';
import { eq } from 'drizzle-orm';
import { createDatabasePool, createDrizzleClient } from '../drizzle/client.js';
import { users } from '../drizzle/schema/users.js';
import { devices } from '../drizzle/schema/devices.js';
import { interests } from '../drizzle/schema/interests.js';
import { profilePromptDefinitions } from '../drizzle/schema/profile-prompt-definitions.js';

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

  // Seed curated interests
  const curatedInterests = [
    {
      id: '018f0000-0000-7000-8000-000000000101',
      name: 'Photography',
      slug: 'photography',
      category: 'ARTS',
    },
    {
      id: '018f0000-0000-7000-8000-000000000102',
      name: 'Hiking',
      slug: 'hiking',
      category: 'OUTDOORS',
    },
    {
      id: '018f0000-0000-7000-8000-000000000103',
      name: 'Coffee',
      slug: 'coffee',
      category: 'FOOD',
    },
    {
      id: '018f0000-0000-7000-8000-000000000104',
      name: 'Cooking',
      slug: 'cooking',
      category: 'FOOD',
    },
    { id: '018f0000-0000-7000-8000-000000000105', name: 'Yoga', slug: 'yoga', category: 'SPORTS' },
    {
      id: '018f0000-0000-7000-8000-000000000106',
      name: 'Running',
      slug: 'running',
      category: 'SPORTS',
    },
    {
      id: '018f0000-0000-7000-8000-000000000107',
      name: 'Indie Music',
      slug: 'indie-music',
      category: 'MUSIC',
    },
    {
      id: '018f0000-0000-7000-8000-000000000108',
      name: 'Live Concerts',
      slug: 'live-concerts',
      category: 'MUSIC',
    },
    {
      id: '018f0000-0000-7000-8000-000000000109',
      name: 'Coding',
      slug: 'coding',
      category: 'TECH',
    },
    {
      id: '018f0000-0000-7000-8000-000000000110',
      name: 'Artificial Intelligence',
      slug: 'ai',
      category: 'TECH',
    },
    {
      id: '018f0000-0000-7000-8000-000000000111',
      name: 'Traveling',
      slug: 'traveling',
      category: 'LIFESTYLE',
    },
    {
      id: '018f0000-0000-7000-8000-000000000112',
      name: 'Reading',
      slug: 'reading',
      category: 'LIFESTYLE',
    },
    {
      id: '018f0000-0000-7000-8000-000000000113',
      name: 'Museums & Galleries',
      slug: 'museums',
      category: 'ARTS',
    },
    {
      id: '018f0000-0000-7000-8000-000000000114',
      name: 'Board Games',
      slug: 'board-games',
      category: 'LIFESTYLE',
    },
    {
      id: '018f0000-0000-7000-8000-000000000115',
      name: 'Dogs & Pets',
      slug: 'pets',
      category: 'LIFESTYLE',
    },
  ];

  for (const item of curatedInterests) {
    const existing = await db
      .select()
      .from(interests)
      .where(eq(interests.slug, item.slug))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(interests).values(item);
    }
  }

  // Seed curated prompt definitions
  const curatedPrompts = [
    {
      id: '018f0000-0000-7000-8000-000000000201',
      prompt: 'A life goal of mine is...',
      category: 'GETTING_TO_KNOW',
      sortOrder: 1,
    },
    {
      id: '018f0000-0000-7000-8000-000000000202',
      prompt: 'The quickest way to my heart is...',
      category: 'DATING',
      sortOrder: 2,
    },
    {
      id: '018f0000-0000-7000-8000-000000000203',
      prompt: 'Two truths and a lie...',
      category: 'HUMOR',
      sortOrder: 3,
    },
    {
      id: '018f0000-0000-7000-8000-000000000204',
      prompt: 'My simple pleasures are...',
      category: 'LIFESTYLE',
      sortOrder: 4,
    },
    {
      id: '018f0000-0000-7000-8000-000000000205',
      prompt: 'I am looking for someone who...',
      category: 'DATING',
      sortOrder: 5,
    },
    {
      id: '018f0000-0000-7000-8000-000000000206',
      prompt: 'Together, we could...',
      category: 'DATING',
      sortOrder: 6,
    },
    {
      id: '018f0000-0000-7000-8000-000000000207',
      prompt: 'A shower thought I recently had...',
      category: 'HUMOR',
      sortOrder: 7,
    },
  ];

  for (const p of curatedPrompts) {
    const existing = await db
      .select()
      .from(profilePromptDefinitions)
      .where(eq(profilePromptDefinitions.id, p.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(profilePromptDefinitions).values(p);
    }
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
