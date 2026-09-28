import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';
import { createTestApp } from './test-app.helper.js';

describe('Error Handling and Response Envelopes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('404 on unknown route returns canonical ApiFailureEnvelope', async () => {
    const res = await request(app.getHttpServer()).get('/unknown-nonexistent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    expect(res.body.error.path).toBe('/unknown-nonexistent-endpoint');
    expect(res.body.error.timestamp).toBeDefined();
  });

  it('400 on input validation failure returns VALIDATION_ERROR envelope with field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: 'a', age: 12 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);

    const fieldNames = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('age');
  });

  it('400 rejects prototype pollution payloads', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/validate')
      .send(JSON.parse('{"__proto__": {"admin": true}, "name": "Alice", "age": 25}'));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(res.body.error.message).toContain('Prototype pollution');
  });

  it('500 on unhandled exception returns INTERNAL_SERVER_ERROR without leaking stack trace', async () => {
    const res = await request(app.getHttpServer()).get('/test/boom');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(res.body.error.message).toBe('Internal server error');
    // Stack trace must NEVER be in response body in standard error filter output
    expect(res.body.error.stack).toBeUndefined();
  });

  it('200 on valid input returns canonical ApiSuccessEnvelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/validate')
      .send({ name: 'Sammy', age: 24 });

    expect(res.status).toBe(201); // Default NestJS POST status
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.data.received.name).toBe('Sammy');
    expect(res.body.data.received.age).toBe(24);
  });
});
