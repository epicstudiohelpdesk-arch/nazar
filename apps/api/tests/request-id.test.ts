import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HEADER_REQUEST_ID } from '@platform/api-contracts';
import { createTestApp } from './test-app.helper.js';

describe('Request ID Middleware and Tracing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a valid UUIDv7 request ID when none is provided in request', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    const headerRequestId = res.headers[HEADER_REQUEST_ID];
    expect(headerRequestId).toBeDefined();
    // UUIDv7 format regex: 8-4-7-4-12 hex chars with version 7
    expect(headerRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.body.requestId).toBe(headerRequestId);
  });

  it('preserves and propagates a valid incoming x-request-id header', async () => {
    const customId = 'req-trace-custom-uuid-001';
    const res = await request(app.getHttpServer()).get('/health').set(HEADER_REQUEST_ID, customId);

    expect(res.headers[HEADER_REQUEST_ID]).toBe(customId);
    expect(res.body.requestId).toBe(customId);
  });

  it('replaces an invalid x-request-id (e.g. too short or illegal chars) with a generated UUIDv7', async () => {
    const maliciousId = '<script>bad</script>';
    const res = await request(app.getHttpServer())
      .get('/health')
      .set(HEADER_REQUEST_ID, maliciousId);

    const resultingId = res.headers[HEADER_REQUEST_ID];
    expect(resultingId).not.toBe(maliciousId);
    expect(resultingId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.body.requestId).toBe(resultingId);
  });
});
