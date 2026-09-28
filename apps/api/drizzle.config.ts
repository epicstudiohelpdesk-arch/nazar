import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/database/drizzle/schema/index.ts',
  out: './src/infrastructure/database/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL || 'postgresql://nazar_user:nazar_password@localhost:5432/nazar_db',
  },
  verbose: true,
  strict: true,
});
