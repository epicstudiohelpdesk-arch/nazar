import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { AdminSessionsRepository } from '../src/modules/admin/repositories/admin-sessions.repository.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { TokenService } from '../src/modules/auth/tokens/token.service.js';
import crypto from 'node:crypto';

describe('Gate 14: Admin Authentication & Credential Segregation', () => {
  let app: INestApplication;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;
  let adminSessionsRepo: AdminSessionsRepository;
  let authService: AuthService;

  const testSuperAdminEmail = `superadmin-${Date.now()}@nazar.internal`;
  const testPassword = 'SecureAdminPassword123!';
  let testAdminId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);
    adminSessionsRepo = app.get(AdminSessionsRepository);
    authService = app.get(AuthService);

    // Bootstrap seed admin and create dedicated test super admin
    await adminAuthService.ensureSeedAdmin();
    testAdminId = crypto.randomUUID();
    const passwordHash = adminAuthService.hashPassword(testPassword);

    await adminUsersRepo.createAdminUser({
      id: testAdminId,
      email: testSuperAdminEmail,
      passwordHash,
      firstName: 'Test',
      lastName: 'SuperAdmin',
      isActive: true,
      mfaEnabled: false,
    });
    await adminUsersRepo.assignRole(testAdminId, 'SUPER_ADMIN');
  });

  afterAll(async () => {
    await app.close();
  });

  it('should authenticate administrative staff with valid credentials', async () => {
    const res = await request(app.getHttpServer()).post('/v1/admin/auth/login').send({
      email: testSuperAdminEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    expect(body.accessToken).toBeDefined();
    expect(body.expiresIn).toBe(3600);
    expect(body.admin).toBeDefined();
    expect(body.admin.email).toBe(testSuperAdminEmail);
    expect(body.admin.roles).toContain('SUPER_ADMIN');
    expect(body.sessionId).toBeDefined();
  });

  it('should reject login with invalid password', async () => {
    const res = await request(app.getHttpServer()).post('/v1/admin/auth/login').send({
      email: testSuperAdminEmail,
      password: 'WrongPassword999!',
    });

    expect(res.status).toBe(401);
  });

  it('should reject login for deactivated staff accounts', async () => {
    const deactivatedEmail = `deactivated-${Date.now()}@nazar.internal`;
    const deactId = crypto.randomUUID();
    await adminUsersRepo.createAdminUser({
      id: deactId,
      email: deactivatedEmail,
      passwordHash: adminAuthService.hashPassword(testPassword),
      firstName: 'Deact',
      lastName: 'User',
      isActive: false,
      mfaEnabled: false,
    });

    const res = await request(app.getHttpServer()).post('/v1/admin/auth/login').send({
      email: deactivatedEmail,
      password: testPassword,
    });

    expect(res.status).toBe(403);
  });

  it('should retrieve current admin profile and active sessions', async () => {
    const loginRes = await adminAuthService.login({
      email: testSuperAdminEmail,
      password: testPassword,
    });

    const meRes = await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${loginRes.accessToken}`);

    expect(meRes.status).toBe(200);
    const body = meRes.body.data || meRes.body;
    expect(body.admin.email).toBe(testSuperAdminEmail);
    expect(body.sessionId).toBe(loginRes.sessionId);

    const sessionsRes = await request(app.getHttpServer())
      .get('/v1/admin/auth/sessions')
      .set('Authorization', `Bearer ${loginRes.accessToken}`);

    expect(sessionsRes.status).toBe(200);
    const sessionsBody = sessionsRes.body.data || sessionsRes.body;
    expect(Array.isArray(sessionsBody.sessions)).toBe(true);
    expect(sessionsBody.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('should properly revoke admin session on logout', async () => {
    const loginRes = await adminAuthService.login({
      email: testSuperAdminEmail,
      password: testPassword,
    });

    const logoutRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/logout')
      .set('Authorization', `Bearer ${loginRes.accessToken}`);

    expect(logoutRes.status).toBe(200);

    // Subsequent authenticated request using the revoked token must fail
    const meRes = await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${loginRes.accessToken}`);

    expect(meRes.status).toBe(401);
  });

  it('CRITICAL: must reject consumer user tokens on admin routes', async () => {
    // 1. Create a consumer token
    const tokenService = app.get(TokenService);
    const consumerToken = tokenService.generateAccessToken({
      sub: crypto.randomUUID(),
      sid: crypto.randomUUID(),
    });

    // 2. Attempt to hit admin endpoint with consumer token
    const res = await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(401);
  });

  it('CRITICAL: must reject admin tokens on consumer user routes', async () => {
    const loginRes = await adminAuthService.login({
      email: testSuperAdminEmail,
      password: testPassword,
    });
    const adminToken = loginRes.accessToken;

    // Attempt to hit consumer endpoint with admin token
    const res = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(401);
  });
});
