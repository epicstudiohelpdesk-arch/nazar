import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/users.js';
import { adminAuditLogs } from '../src/infrastructure/database/drizzle/schema/admin.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Gate 14: Admin Immutable Audit Logging & Concurrency', () => {
  let app: INestApplication;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;
  let databaseService: DatabaseService;

  let adminToken: string;
  let adminEmail: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);
    databaseService = app.get(DatabaseService);

    await adminAuthService.ensureDefaultRolesAndPermissions();

    const password = 'AdminAuditPassword123!';
    const adminId = crypto.randomUUID();
    adminEmail = `audit-${Date.now()}@nazar.internal`;

    await adminUsersRepo.createAdminUser({
      id: adminId,
      email: adminEmail,
      passwordHash: adminAuthService.hashPassword(password),
      firstName: 'Audit',
      lastName: 'Officer',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(adminId, 'SUPER_ADMIN');

    const loginRes = await adminAuthService.login({
      email: adminEmail,
      password,
    });
    adminToken = loginRes.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('administrative mutation creates immutable audit record with metadata and request ID', async () => {
    const targetUserId = crypto.randomUUID();
    await databaseService.client.insert(users).values({
      id: targetUserId,
      status: 'ACTIVE',
    });

    const reason = 'Suspension due to verified safety violation';
    const requestId = 'req-audit-test-12345';

    const res = await request(app.getHttpServer())
      .post(`/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-request-id', requestId)
      .send({
        reason,
        durationDays: 3,
      });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.auditLogId).toBeDefined();

    // Verify row directly in admin_audit_logs
    const [auditRow] = await databaseService.client
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.id, body.auditLogId));

    expect(auditRow).toBeDefined();
    expect(auditRow?.actorEmail).toBe(adminEmail);
    expect(auditRow?.action).toBe('USER_SUSPEND');
    expect(auditRow?.resourceType).toBe('USER');
    expect(auditRow?.resourceId).toBe(targetUserId);
    expect(auditRow?.reason).toBe(reason);
    expect(auditRow?.requestId).toBe(requestId);
    expect(auditRow?.previousState).toEqual({ status: 'ACTIVE' });
    expect(auditRow?.newState).toEqual({ status: 'SUSPENDED', durationDays: 3 });
  });

  it('can query and filter audit logs via administrative API', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/audit/logs?action=USER_SUSPEND')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].action).toBe('USER_SUSPEND');
    expect(body.items[0].reason).toBeDefined();
  });

  it('concurrency: concurrent administrative actions generate distinct non-conflicting audit trails', async () => {
    const count = 5;
    const userIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const uid = crypto.randomUUID();
      userIds.push(uid);
      await databaseService.client.insert(users).values({
        id: uid,
        status: 'ACTIVE',
      });
    }

    // Trigger concurrent suspensions
    const promises = userIds.map((uid, index) =>
      request(app.getHttpServer())
        .post(`/v1/admin/users/${uid}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: `Concurrent suspension test batch #${index + 1}`,
          durationDays: index + 1,
        })
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      expect(res.status).toBe(200);
      const b = res.body.data || res.body;
      expect(b.success).toBe(true);
      expect(b.auditLogId).toBeDefined();
    }

    // Check all 5 audit logs exist in database
    const logs = await databaseService.client
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.actorEmail, adminEmail));

    expect(logs.length).toBeGreaterThanOrEqual(count + 1);
  });
});
