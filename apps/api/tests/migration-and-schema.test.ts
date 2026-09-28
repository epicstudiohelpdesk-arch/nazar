import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DATABASE_SERVICE_TOKEN } from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users, devices, sessions } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Migration and Foundational Schema Verification', () => {
  let app: INestApplication;
  let dbService: DatabaseService;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    dbService = app.get<DatabaseService>(DATABASE_SERVICE_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should verify all Gate 03 foundational tables exist in public schema', async () => {
    const expectedTables = [
      'users',
      'devices',
      'sessions',
      'idempotency_keys',
      'outbox_events',
      'audit_logs',
      'security_events',
    ];

    const result = await dbService.drizzle.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    `);

    const tableNames = result.rows.map((r) => r.table_name);
    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('should verify drizzle migration journal exists', async () => {
    const result = await dbService.drizzle.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations;
    `);

    expect(Number(result.rows[0].count)).toBeGreaterThan(0);
  });

  it('should enforce cascading delete from users to devices and sessions', async () => {
    const userId = generateUuidV7();
    const deviceId = generateUuidV7();
    const sessionId = generateUuidV7();

    // Insert user
    await dbService.drizzle.insert(users).values({
      id: userId,
      status: 'active',
      metadata: { test: true },
    });

    // Insert device referencing user
    await dbService.drizzle.insert(devices).values({
      id: deviceId,
      userId,
      platform: 'ios',
      deviceModel: 'iPhone 15 Pro',
      appVersion: '1.0.0',
    });

    // Insert session referencing user and device
    await dbService.drizzle.insert(sessions).values({
      id: sessionId,
      userId,
      deviceId,
      tokenHash: 'dummy_hash_for_testing_' + Date.now(),
      expiresAt: new Date(Date.now() + 3600_000),
    });

    // Verify insertion
    const [user] = await dbService.drizzle.select().from(users).where(eq(users.id, userId));
    const [device] = await dbService.drizzle.select().from(devices).where(eq(devices.id, deviceId));
    const [session] = await dbService.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    expect(user).toBeDefined();
    expect(device).toBeDefined();
    expect(session).toBeDefined();

    // Delete user -> CASCADE should delete device and session
    await dbService.drizzle.delete(users).where(eq(users.id, userId));

    const checkDevice = await dbService.drizzle
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId));
    const checkSession = await dbService.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    expect(checkDevice).toHaveLength(0);
    expect(checkSession).toHaveLength(0);
  });
});
