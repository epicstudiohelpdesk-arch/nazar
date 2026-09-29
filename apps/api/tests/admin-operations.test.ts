import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  users,
  profiles,
  reports,
  moderationCases,
  userRestrictions,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Gate 14: Admin Operations, Moderation & Health', () => {
  let app: INestApplication;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;
  let databaseService: DatabaseService;

  let adminToken: string;
  let targetUserId: string;
  let reporterUserId: string;
  let testCaseId: string;
  let testReportId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);
    databaseService = app.get(DatabaseService);

    await adminAuthService.ensureSeedAdmin();

    const password = 'AdminOperationsPass123!';
    const adminId = crypto.randomUUID();
    await adminUsersRepo.createAdminUser({
      id: adminId,
      email: `ops-${Date.now()}@nazar.internal`,
      passwordHash: adminAuthService.hashPassword(password),
      firstName: 'Operations',
      lastName: 'Manager',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(adminId, 'SUPER_ADMIN');
    const loginRes = await adminAuthService.login({
      email: (await adminUsersRepo.findById(adminId))!.email,
      password,
    });
    adminToken = loginRes.accessToken;

    // Seed target user & profile
    targetUserId = crypto.randomUUID();
    await databaseService.client.insert(users).values({
      id: targetUserId,
      status: 'ACTIVE',
    });
    await databaseService.client.insert(profiles).values({
      id: crypto.randomUUID(),
      userId: targetUserId,
      displayName: 'Investigation Target',
      dateOfBirth: '1995-05-15',
      gender: 'WOMAN',
      bio: 'Investigative bio for operations test',
      completionStatus: { isComplete: true, missingFields: [] } as any,
    });

    // Seed reporter user
    reporterUserId = crypto.randomUUID();
    await databaseService.client.insert(users).values({
      id: reporterUserId,
      status: 'ACTIVE',
    });

    // Seed moderation case
    testCaseId = crypto.randomUUID();
    await databaseService.client.insert(moderationCases).values({
      id: testCaseId,
      subjectUserId: targetUserId,
      sourceType: 'REPORT',
      caseType: 'USER_CONDUCT',
      status: 'OPEN',
      priority: 'HIGH',
    });

    // Seed report
    testReportId = crypto.randomUUID();
    await databaseService.client.insert(reports).values({
      id: testReportId,
      reporterUserId,
      targetType: 'USER',
      targetId: targetUserId,
      targetUserId,
      reasonCode: 'HARASSMENT',
      description: 'Repeated offensive messages in chat',
      status: 'OPEN',
      moderationCaseId: testCaseId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should search users and get detailed user record', async () => {
    const searchRes = await request(app.getHttpServer())
      .get('/v1/admin/users?query=Investigation')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    const searchBody = searchRes.body.data || searchRes.body;
    expect(searchBody.items.length).toBeGreaterThanOrEqual(1);

    const detailRes = await request(app.getHttpServer())
      .get(`/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailRes.status).toBe(200);
    const detailBody = detailRes.body.data || detailRes.body;
    expect(detailBody.user.id).toBe(targetUserId);
    expect(detailBody.user.profile.displayName).toBe('Investigation Target');
    expect(detailBody.user.safetyStats.reportsReceivedCount).toBeGreaterThanOrEqual(1);
  });

  it('CRITICAL: should reject account suspension when mandatory reason is missing or too short', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'no', // too short (< 3 chars)
      });

    expect(res.status).toBe(400);
  });

  it('should suspend user with mandatory reason and apply restrictions', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Confirmed terms of service violation on harassment investigation',
        durationDays: 14,
      });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.success).toBe(true);

    // Verify user row
    const [userRow] = await databaseService.client
      .select()
      .from(users)
      .where(eq(users.id, targetUserId));
    expect(userRow?.status).toBe('SUSPENDED');

    // Verify restriction
    const restrictions = await databaseService.client
      .select()
      .from(userRestrictions)
      .where(eq(userRestrictions.userId, targetUserId));
    expect(restrictions.length).toBeGreaterThanOrEqual(1);
    expect(restrictions[0]?.restrictionType).toBe('FULL_ACCOUNT');
  });

  it('should restore suspended user with mandatory reason', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Appeal successfully accepted following operator review',
      });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.success).toBe(true);

    const [userRow] = await databaseService.client
      .select()
      .from(users)
      .where(eq(users.id, targetUserId));
    expect(userRow?.status).toBe('ACTIVE');
  });

  it('should assign and decide moderation case with mandatory reason', async () => {
    const assignRes = await request(app.getHttpServer())
      .post(`/v1/admin/moderation/cases/${testCaseId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedAdminId: crypto.randomUUID(),
        reason: 'Assigned to specialized safety investigator',
      });

    expect(assignRes.status).toBe(200);

    const decideRes = await request(app.getHttpServer())
      .post(`/v1/admin/moderation/cases/${testCaseId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'WARNING',
        reason: 'First time minor violation; issued formal safety warning',
        notes: 'Advised user on community conduct standards',
      });

    expect(decideRes.status).toBe(200);
    const decideBody = decideRes.body.data || decideRes.body;
    expect(decideBody.status).toBe('RESOLVED');
    expect(decideBody.action).toBe('WARNING');
  });

  it('should return live operational dashboard metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/operations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.metrics.users.totalCount).toBeGreaterThanOrEqual(2);
    expect(body.metrics.system.status).toBeDefined();
  });

  it('should return internal system health and infrastructure latency', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/system/health')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.health.services.database.status).toBe('UP');
    expect(body.health.uptimeSeconds).toBeGreaterThan(0);
    expect(body.health.memory.rssMb).toBeGreaterThan(0);
  });
});
