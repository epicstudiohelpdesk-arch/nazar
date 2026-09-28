import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DATABASE_SERVICE_TOKEN } from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Transaction Management and Rollback Integrity', () => {
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

  it('should commit all changes when transaction callback succeeds', async () => {
    const userId = generateUuidV7();

    const result = await dbService.withTransaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          id: userId,
          status: 'active',
          metadata: { txTest: true },
        })
        .returning();

      return inserted;
    });

    expect(result.id).toBe(userId);

    // Verify row was persisted
    const [persisted] = await dbService.drizzle.select().from(users).where(eq(users.id, userId));
    expect(persisted).toBeDefined();
    expect(persisted.id).toBe(userId);

    // Cleanup
    await dbService.drizzle.delete(users).where(eq(users.id, userId));
  });

  it('should cleanly rollback all changes when an exception is thrown in transaction', async () => {
    const userId = generateUuidV7();

    const txPromise = dbService.withTransaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        status: 'active',
        metadata: { willRollback: true },
      });

      throw new Error('Simulated transactional failure');
    });

    await expect(txPromise).rejects.toThrow('Simulated transactional failure');

    // Verify row was NOT persisted
    const [persisted] = await dbService.drizzle.select().from(users).where(eq(users.id, userId));
    expect(persisted).toBeUndefined();
  });

  it('should verify DrizzleTransactionManager wrapper delegates transactions', async () => {
    const manager = dbService.transactionManager;
    const userId = generateUuidV7();

    const result = await manager.withTransaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          id: userId,
          status: 'active',
          metadata: { managerTest: true },
        })
        .returning();
      return inserted;
    });

    expect(result.id).toBe(userId);
    const [persisted] = await dbService.drizzle.select().from(users).where(eq(users.id, userId));
    expect(persisted).toBeDefined();

    await dbService.drizzle.delete(users).where(eq(users.id, userId));
  });

  it('should support manual Unit of Work lifecycle start, commit, and rollback', async () => {
    // 1. Commit scenario
    const uow1 = await dbService.createUnitOfWork();
    await uow1.start();
    const userId1 = generateUuidV7();

    await dbService.pool.query(
      `INSERT INTO users (id, status, created_at, updated_at) VALUES ($1, 'active', NOW(), NOW())`,
      [userId1]
    );
    await uow1.commit();

    const [user1] = await dbService.drizzle.select().from(users).where(eq(users.id, userId1));
    expect(user1).toBeDefined();
    await dbService.drizzle.delete(users).where(eq(users.id, userId1));

    // 2. Rollback scenario
    const uow2 = await dbService.createUnitOfWork();
    await uow2.start();
    await uow2.rollback();
  });
});
