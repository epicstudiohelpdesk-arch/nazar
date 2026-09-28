import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';

describe('Health and Readiness API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return 200 with liveness envelope', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.service).toBe('nazar-api');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
  });

  it('GET /ready should return 200 with process health indicator', async () => {
    const res = await request(app.getHttpServer()).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.checks.process.status).toBe('healthy');
  });

  it('GET /v1/health should resolve under the versioned route', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  it('GET /v1/ready should resolve under the versioned route', async () => {
    const res = await request(app.getHttpServer()).get('/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  it('GET /docs should serve OpenAPI Swagger UI', async () => {
    const res = await request(app.getHttpServer()).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
