import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HEADER_IDEMPOTENCY_KEY, ErrorCode } from '@platform/api-contracts';
import { createTestApp } from './test-app.helper.js';

describe('Idempotency Subsystem', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an @Idempotent() endpoint call missing the idempotency-key header', async () => {
    const res = await request(app.getHttpServer()).post('/test/idempotent');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.error.message).toContain(HEADER_IDEMPOTENCY_KEY);
  });

  it('executes mutation on first call with an idempotency key', async () => {
    const key = 'idem-first-call-key-1001';
    const res = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set(HEADER_IDEMPOTENCY_KEY, key);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.headers['x-idempotent-replayed']).toBeUndefined();
    expect(res.body.data.executionCount).toBe(1);
    expect(res.body.data.message).toBe('Mutation executed');
  });

  it('replays previously cached response and does not re-execute on subsequent identical call', async () => {
    const key = 'idem-first-call-key-1001'; // Same key as previous test
    const res = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set(HEADER_IDEMPOTENCY_KEY, key);

    expect(res.status).toBe(201);
    expect(res.headers['x-idempotent-replayed']).toBe('true');
    expect(res.body.success).toBe(true);
    // Execution count must still be 1 because handler was not invoked again!
    expect(res.body.data.executionCount).toBe(1);
  });

  it('executes again for a new unique idempotency key', async () => {
    const key = 'idem-second-call-key-1002';
    const res = await request(app.getHttpServer())
      .post('/test/idempotent')
      .set(HEADER_IDEMPOTENCY_KEY, key);

    expect(res.status).toBe(201);
    expect(res.headers['x-idempotent-replayed']).toBeUndefined();
    expect(res.body.data.executionCount).toBe(2);
  });
});
