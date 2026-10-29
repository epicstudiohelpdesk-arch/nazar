import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/users.js';
import crypto from 'node:crypto';

describe('Gate 14: Admin Role-Based Access Control (RBAC)', () => {
  let app: INestApplication;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;
  let databaseService: DatabaseService;

  let superAdminToken: string;
  let readOnlyToken: string;
  let trustSafetyToken: string;
  let targetConsumerUserId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);
    databaseService = app.get(DatabaseService);

    await adminAuthService.ensureDefaultRolesAndPermissions();

    const password = 'RoleTestPassword123!';

    // 1. Super Admin
    const superAdminId = crypto.randomUUID();
    await adminUsersRepo.createAdminUser({
      id: superAdminId,
      email: `super-${Date.now()}@nazar.internal`,
      passwordHash: adminAuthService.hashPassword(password),
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(superAdminId, 'SUPER_ADMIN');
    const superLogin = await adminAuthService.login({
      email: (await adminUsersRepo.findById(superAdminId))!.email,
      password,
    });
    superAdminToken = superLogin.accessToken;

    // 2. Read-Only Operator
    const readOnlyId = crypto.randomUUID();
    await adminUsersRepo.createAdminUser({
      id: readOnlyId,
      email: `readonly-${Date.now()}@nazar.internal`,
      passwordHash: adminAuthService.hashPassword(password),
      firstName: 'ReadOnly',
      lastName: 'Operator',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(readOnlyId, 'READ_ONLY_OPERATOR');
    const readOnlyLogin = await adminAuthService.login({
      email: (await adminUsersRepo.findById(readOnlyId))!.email,
      password,
    });
    readOnlyToken = readOnlyLogin.accessToken;

    // 3. Trust & Safety Admin
    const tsAdminId = crypto.randomUUID();
    await adminUsersRepo.createAdminUser({
      id: tsAdminId,
      email: `trust-${Date.now()}@nazar.internal`,
      passwordHash: adminAuthService.hashPassword(password),
      firstName: 'Trust',
      lastName: 'Safety',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(tsAdminId, 'TRUST_SAFETY_ADMIN');
    const tsLogin = await adminAuthService.login({
      email: (await adminUsersRepo.findById(tsAdminId))!.email,
      password,
    });
    trustSafetyToken = tsLogin.accessToken;

    // 4. Create target consumer user in database
    targetConsumerUserId = crypto.randomUUID();
    await databaseService.client.insert(users).values({
      id: targetConsumerUserId,
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('READ_ONLY_OPERATOR can read users list', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${readOnlyToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('READ_ONLY_OPERATOR is forbidden from executing mutations (users.suspend)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetConsumerUserId}/suspend`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({
        reason: 'Attempted unauthorized suspension by read-only operator',
      });

    expect(res.status).toBe(403);
    const body = res.body.error || res.body;
    expect(body.message).toMatch(/Insufficient administrative permissions/i);
  });

  it('TRUST_SAFETY_ADMIN can suspend users (holds users.suspend)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetConsumerUserId}/suspend`)
      .set('Authorization', `Bearer ${trustSafetyToken}`)
      .send({
        reason: 'Authorized suspension by Trust & Safety admin',
        durationDays: 7,
      });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.success).toBe(true);
    expect(body.action).toBe('USER_SUSPEND');
    expect(body.auditLogId).toBeDefined();
  });

  it('SUPER_ADMIN bypasses granular constraints and can restore users', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetConsumerUserId}/restore`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        reason: 'Super Admin restoring user account following review',
      });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.success).toBe(true);
    expect(body.action).toBe('USER_RESTORE');
  });
});
