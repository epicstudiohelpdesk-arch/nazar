import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function runMigrations(
  db: NodePgDatabase<Record<string, unknown>>,
  migrationsFolder?: string
): Promise<void> {
  const folder = migrationsFolder || path.resolve(__dirname, './migrations');
  await migrate(db, { migrationsFolder: folder });
}
