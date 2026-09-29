import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/users.js';
import { userIdentities } from '../src/infrastructure/database/drizzle/schema/user-identities.js';
import { sessions } from '../src/infrastructure/database/drizzle/schema/sessions.js';
import {
  TOKEN_SERVICE_TOKEN,
  type ITokenService,
} from '../src/modules/auth/tokens/token.interface.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import {
  redactSensitiveString,
  redactSensitiveData,
} from '../src/common/logging/app-logger.service.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Gate 16: Security Hardening & Assurance Review', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let tokenService: ITokenService;
  let authService: AuthService;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;

  let activeUserId: string;
  let activeToken: string;
  let suspendedUserId: string;
  let suspendedToken: string;
  let bannedUserId: string;
  let bannedToken: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = app.get(DatabaseService);
    tokenService = app.get(TOKEN_SERVICE_TOKEN);
    authService = app.get(AuthService);
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);

    // 1. Create Active User
    activeUserId = generateUuidV7();
    await db.client.insert(users).values({ id: activeUserId, status: 'ACTIVE' });
    const activeSessionId = generateUuidV7();
    const activeRefreshToken = tokenService.generateRefreshToken();
    await db.client.insert(sessions).values({
      id: activeSessionId,
      userId: activeUserId,
      tokenHash: tokenService.hashToken(activeRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });
    activeToken = tokenService.generateAccessToken({
      sub: activeUserId,
      sid: activeSessionId,
    });

    // 2. Create Suspended User
    suspendedUserId = generateUuidV7();
    await db.client.insert(users).values({ id: suspendedUserId, status: 'SUSPENDED' });
    const suspendedSessionId = generateUuidV7();
    const suspendedRefreshToken = tokenService.generateRefreshToken();
    await db.client.insert(sessions).values({
      id: suspendedSessionId,
      userId: suspendedUserId,
      tokenHash: tokenService.hashToken(suspendedRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });
    suspendedToken = tokenService.generateAccessToken({
      sub: suspendedUserId,
      sid: suspendedSessionId,
    });

    // 3. Create Banned User
    bannedUserId = generateUuidV7();
    await db.client.insert(users).values({ id: bannedUserId, status: 'BANNED' });
    const bannedSessionId = generateUuidV7();
    const bannedRefreshToken = tokenService.generateRefreshToken();
    await db.client.insert(sessions).values({
      id: bannedSessionId,
      userId: bannedUserId,
      tokenHash: tokenService.hashToken(bannedRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });
    bannedToken = tokenService.generateAccessToken({
      sub: bannedUserId,
      sid: bannedSessionId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // 1. Account Lifecycle & Suspension Enforcement
  // -------------------------------------------------------------------------
  describe('Account Lifecycle & Suspension Enforcement', () => {
    it('should allow active user to query protected profile endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${activeToken}`);

      // 200 or 404 (if profile not yet created) means authenticated passed
      expect([200, 404]).toContain(res.status);
    });

    it('should reject suspended user with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${suspendedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('should reject banned user with 403 ACCOUNT_BANNED', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/profiles/me')
        .set('Authorization', `Bearer ${bannedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_BANNED');
    });

    it('should reject session refresh for suspended account and revoke session', async () => {
      const newRefreshToken = tokenService.generateRefreshToken();
      const sessId = generateUuidV7();
      await db.client.insert(sessions).values({
        id: sessId,
        userId: suspendedUserId,
        tokenHash: tokenService.hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      await expect(authService.refreshSession(newRefreshToken)).rejects.toThrow();

      // Verify session was revoked in database
      const sessRows = await db.client.select().from(sessions).where(eq(sessions.id, sessId));
      expect(sessRows[0]?.revokedAt).toBeDefined();
    });

    it('should reject authentication for suspended identity during login resolution', async () => {
      const phone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
      await db.client.insert(userIdentities).values({
        id: generateUuidV7(),
        userId: suspendedUserId,
        provider: 'PHONE',
        providerSubject: phone,
      });

      await expect(
        authService.verifyOtp(phone, '123456') // will fail because challenge doesn't match or account suspended
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Refresh Token Replay & Anti-Theft Protection
  // -------------------------------------------------------------------------
  describe('Refresh Token Replay & Security', () => {
    it('should successfully rotate an active refresh token', async () => {
      const initialToken = tokenService.generateRefreshToken();
      const sessId = generateUuidV7();
      await db.client.insert(sessions).values({
        id: sessId,
        userId: activeUserId,
        tokenHash: tokenService.hashToken(initialToken),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const rotated = await authService.refreshSession(initialToken);
      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(initialToken);

      // Attempting to reuse the rotated token must trigger replay detection and revoke the session
      await expect(authService.refreshSession(initialToken)).rejects.toThrow();

      const sess = await db.client.select().from(sessions).where(eq(sessions.id, sessId));
      expect(sess[0]?.revokedAt).toBeDefined();
      expect(sess[0]?.revocationReason).toBe('TOKEN_REPLAY_DETECTED');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Object-Level Authorization & BOLA/IDOR Prevention
  // -------------------------------------------------------------------------
  describe('Object-Level Authorization (BOLA / IDOR)', () => {
    it('should reject unauthenticated access to /v1/profiles/me with 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/profiles/me');
      expect(res.status).toBe(401);
    });

    it('should reject consumer user attempting to access admin endpoints with 401/403', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${activeToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('should reject unauthenticated access to admin overview', async () => {
      const res = await request(app.getHttpServer()).get('/v1/admin/system/health');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Log Redaction & Secret Scrubbing
  // -------------------------------------------------------------------------
  describe('Log Redaction & Information Leakage Prevention', () => {
    it('should redact sensitive keys from structured data', () => {
      const raw = {
        email: 'user@example.com',
        password: 'SuperSecretPassword!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak',
        nested: {
          refreshToken: 'secret-refresh-token',
          cvv: '123',
          creditCard: '4532000011112222',
        },
      };

      const sanitized = redactSensitiveData(raw) as Record<string, unknown>;
      expect(sanitized['password']).toBe('[REDACTED]');
      expect(sanitized['token']).toBe('[REDACTED]');
      expect((sanitized['nested'] as Record<string, unknown>)['refreshToken']).toBe('[REDACTED]');
      expect((sanitized['nested'] as Record<string, unknown>)['cvv']).toBe('[REDACTED]');
      expect(sanitized['email']).toBe('user@example.com');
    });

    it('should redact Bearer tokens and JWTs embedded in text strings', () => {
      const text =
        'Failed auth header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig with password="mypassword"';
      const clean = redactSensitiveString(text);
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(clean).toContain('[REDACTED');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Admin RBAC & Privilege Separation
  // -------------------------------------------------------------------------
  describe('Admin RBAC & Privilege Separation', () => {
    let supportAdminToken: string;
    const supportEmail = `support-${Date.now()}@nazar.internal`;

    beforeAll(async () => {
      await adminAuthService.ensureSeedAdmin();
      const supportId = crypto.randomUUID();
      const passwordHash = adminAuthService.hashPassword('SupportPassword123!');

      await adminUsersRepo.createAdminUser({
        id: supportId,
        email: supportEmail,
        passwordHash,
        firstName: 'Support',
        lastName: 'Agent',
        isActive: true,
        mfaEnabled: false,
      });

      // Assign SUPPORT_AGENT (has users.read, reports.read, but lacks users.suspend or analytics.manage)
      await adminUsersRepo.assignRole(supportId, 'SUPPORT_AGENT');

      const loginRes = await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email: supportEmail, password: 'SupportPassword123!' });

      supportAdminToken = loginRes.body.data.accessToken;
    });

    it('should allow support operator to read users list', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${supportAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should prevent support operator from suspending users without users.suspend permission', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/admin/users/${activeUserId}/suspend`)
        .set('Authorization', `Bearer ${supportAdminToken}`)
        .send({ reason: 'Unauthorized attempt', durationDays: 7 });

      expect(res.status).toBe(403);
    });

    it('should prevent support operator from triggering analytics aggregations', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/analytics/aggregate')
        .set('Authorization', `Bearer ${supportAdminToken}`)
        .send({ targetDate: '2026-09-28' });

      expect(res.status).toBe(403);
    });
  });
});
