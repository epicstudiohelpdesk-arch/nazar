import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AnalyticsExperimentService } from '../src/modules/analytics/services/analytics-experiment.service.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { generateUuidV7 } from '@platform/domain';
import crypto from 'node:crypto';

describe('Gate 15: Analytics Experimentation Engine', () => {
  let app: INestApplication;
  let experimentService: AnalyticsExperimentService;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;

  let adminToken: string;
  const adminEmail = `exp-admin-${Date.now()}@nazar.internal`;
  const adminPassword = 'AdminPassword123!';

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    experimentService = app.get(AnalyticsExperimentService);
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);

    // Bootstrap seed and create test admin
    await adminAuthService.ensureSeedAdmin();
    const adminId = crypto.randomUUID();
    const passwordHash = adminAuthService.hashPassword(adminPassword);

    await adminUsersRepo.createAdminUser({
      id: adminId,
      email: adminEmail,
      passwordHash,
      firstName: 'Exp',
      lastName: 'Admin',
      isActive: true,
      mfaEnabled: false,
    });

    await adminUsersRepo.assignRole(adminId, 'SUPER_ADMIN');

    const loginRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should deterministically assign a subject to the same variant on repeated calls', async () => {
    const subjectId = generateUuidV7();

    const assignment1 = await experimentService.getOrAssignVariant(
      'discovery_card_layout_v1',
      subjectId
    );

    const assignment2 = await experimentService.getOrAssignVariant(
      'discovery_card_layout_v1',
      subjectId
    );

    expect(assignment1.variant).toBeDefined();
    expect(assignment1.variant).toBe(assignment2.variant);
    expect(assignment1.subjectId).toBe(subjectId);
  });

  it('should distribute distinct subjects across experiment variants', async () => {
    const variantsAssigned = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const subjectId = `test-user-seed-${i}-${Date.now()}`;
      const assignment = await experimentService.getOrAssignVariant(
        'discovery_card_layout_v1',
        subjectId
      );
      variantsAssigned.add(assignment.variant);
    }

    // Should have assigned more than 1 distinct variant
    expect(variantsAssigned.size).toBeGreaterThan(1);
  });

  it('should record variant exposures via client endpoint /v1/analytics/experiments/exposure', async () => {
    const subjectId = generateUuidV7();
    const res = await request(app.getHttpServer())
      .post('/v1/analytics/experiments/exposure')
      .send({
        experimentId: 'discovery_card_layout_v1',
        subjectId,
        variant: 'compact',
        properties: { clientTime: Date.now() },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recorded).toBe(true);
  });

  it('should list experiments with variant metrics via /v1/admin/analytics/experiments', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/analytics/experiments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const match = res.body.data.find(
      (e: { experimentId: string }) => e.experimentId === 'discovery_card_layout_v1'
    );
    expect(match).toBeDefined();
    expect(match.variantMetrics.length).toBeGreaterThan(0);
  });
});
