import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { IDEMPOTENCY_STORE_TOKEN } from '../src/common/idempotency/idempotency.interface.js';
import type { IIdempotencyStore } from '../src/common/idempotency/idempotency.interface.js';
import { DATABASE_SERVICE_TOKEN } from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { idempotencyKeys } from '../src/infrastructure/database/drizzle/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';

describe('Postgres Idempotency Store and Persistence Integration', () => {
  let app: INestApplication;
  let idempotencyStore: IIdempotencyStore;
  let dbService: DatabaseService;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    idempotencyStore = app.get<IIdempotencyStore>(IDEMPOTENCY_STORE_TOKEN);
    dbService = app.get<DatabaseService>(DATABASE_SERVICE_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should persist idempotency record directly to PostgreSQL', async () => {
    const key = `unit-test-${generateUuidV7()}`;
    const scope = 'user-test';

    await idempotencyStore.set({
      key,
      scope,
      requestFingerprint: 'dummy-sha256-fingerprint',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const record = await idempotencyStore.get(key, scope);
    expect(record).not.toBeNull();
    expect(record?.key).toBe(key);
    expect(record?.scope).toBe(scope);
    expect(record?.status).toBe('PENDING');

    // Update to COMPLETED
    await idempotencyStore.update(
      key,
      {
        status: 'COMPLETED',
        statusCode: 201,
        response: { created: true },
      },
      scope
    );

    const updated = await idempotencyStore.get(key, scope);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.statusCode).toBe(201);
    expect(updated?.completedAt).toBeDefined();

    // Cleanup
    await idempotencyStore.delete(key, scope);
    const deleted = await idempotencyStore.get(key, scope);
    expect(deleted).toBeNull();
  });

  it('should throw ConflictException on concurrent duplicate insert in PostgresIdempotencyStore', async () => {
    const key = `race-${generateUuidV7()}`;
    const scope = 'global';

    await idempotencyStore.set({
      key,
      scope,
      requestFingerprint: 'fp-1',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    // Second set with same compound key should conflict
    await expect(
      idempotencyStore.set({
        key,
        scope,
        requestFingerprint: 'fp-1',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    ).rejects.toThrow(ConflictException);

    await idempotencyStore.delete(key, scope);
  });

  it('should persist HTTP idempotency across requests and replay completed response', async () => {
    const idempotencyKey = `http-${generateUuidV7()}`;

    // First request executes mutation
    const res1 = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set('idempotency-key', idempotencyKey)
      .send({ action: 'create' });

    expect(res1.status).toBe(201);
    expect(res1.headers['x-idempotent-replayed']).toBeUndefined();
    const count1 = res1.body.data.executionCount;

    // Verify row in PostgreSQL
    const [row] = await dbService.drizzle
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.scope, 'global')));

    expect(row).toBeDefined();
    expect(row.status).toBe('COMPLETED');
    expect(row.statusCode).toBe(201);

    // Second request returns replayed result with same execution count
    const res2 = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set('idempotency-key', idempotencyKey)
      .send({ action: 'create' });

    expect(res2.status).toBe(201);
    expect(res2.headers['x-idempotent-replayed']).toBe('true');
    expect(res2.body.data.executionCount).toBe(count1);
  });

  it('should reject request with 409 IDEMPOTENCY_CONFLICT when payload fingerprint mismatches', async () => {
    const idempotencyKey = `mismatch-${generateUuidV7()}`;

    // Request with payload A
    const res1 = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set('idempotency-key', idempotencyKey)
      .send({ amount: 100 });

    expect(res1.status).toBe(201);

    // Request with same key but different payload B
    const res2 = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set('idempotency-key', idempotencyKey)
      .send({ amount: 200 });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('should gracefully handle concurrent HTTP requests with same idempotency key', async () => {
    const idempotencyKey = `concurrent-${generateUuidV7()}`;

    // Fire 3 concurrent requests simultaneously
    const requests = [1, 2, 3].map(() =>
      request(app.getHttpServer())
        .post('/test/idempotent')
        .set('idempotency-key', idempotencyKey)
        .send({ key: 'value' })
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map((r) => r.status);

    // At least one must succeed with 201 (the winner or completed replayers),
    // and any caught during in-flight pending return 409 conflict
    expect(statusCodes).toContain(201);
    for (const code of statusCodes) {
      expect([201, 409]).toContain(code);
    }
  });
});
