import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { DATABASE_SERVICE_TOKEN } from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';

describe('Database Readiness and Liveness Decoupling', () => {
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

  it('should report healthy readiness when database is accessible', async () => {
    const res = await request(app.getHttpServer()).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.checks.database).toBeDefined();
    expect(res.body.data.checks.database.status).toBe('healthy');
    expect(res.body.data.checks.process.status).toBe('healthy');
  });

  it('should report healthy liveness regardless of database status', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    // Process liveness does not run database queries
    expect(res.body.data.checks).toBeUndefined();
  });

  it('should return 503 on /ready while /health remains 200 when database fails', async () => {
    // Simulate database outage
    const spy = vi.spyOn(dbService, 'healthCheck').mockResolvedValue(false);

    try {
      // Readiness check must fail with 503
      const readyRes = await request(app.getHttpServer()).get('/ready');
      expect(readyRes.status).toBe(503);
      expect(readyRes.body.data.status).toBe('unhealthy');
      expect(readyRes.body.data.checks.database.status).toBe('unhealthy');
      expect(readyRes.body.data.checks.process.status).toBe('healthy');

      // Liveness check must remain 200 OK
      const healthRes = await request(app.getHttpServer()).get('/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.success).toBe(true);
      expect(healthRes.body.data.status).toBe('healthy');
    } finally {
      spy.mockRestore();
    }

    // Verify recovery
    const recoveredRes = await request(app.getHttpServer()).get('/ready');
    expect(recoveredRes.status).toBe(200);
    expect(recoveredRes.body.data.status).toBe('healthy');
    expect(recoveredRes.body.data.checks.database.status).toBe('healthy');
  });
});
