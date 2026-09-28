import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HEADER_REQUEST_ID } from '@platform/api-contracts';
import { createTestApp } from './test-app.helper.js';

describe('CORS and Security Headers', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('includes Helmet security headers in responses', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-download-options']).toBe('noopen');
  });

  it('responds with CORS headers for cross-origin requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(res.headers['access-control-expose-headers']).toContain(HEADER_REQUEST_ID);
    expect(res.headers['access-control-expose-headers']).toContain('x-idempotent-replayed');
  });

  it('handles CORS OPTIONS preflight requests cleanly', async () => {
    const res = await request(app.getHttpServer())
      .options('/test/idempotent')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, x-request-id, idempotency-key');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});
