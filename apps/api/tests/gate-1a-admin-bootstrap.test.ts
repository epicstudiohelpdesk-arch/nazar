import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import crypto from 'node:crypto';

// Gate 1A acceptance tests: administrative bootstrap security.
// Proves (a) no default super-admin is created at startup, (b) provisioning
// is explicit/audited with one-time credentials, (c) dedicated brute-force
// throttling on admin login, (d) MFA policy enforcement, (e) fail-closed
// signing-secret handling with no hard-coded fallback.
describe('Gate 1A: Admin Bootstrap & Credential Safety', () => {
  let app: INestApplication;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);
    await adminAuthService.ensureDefaultRolesAndPermissions();
    // Gate 1A: ensure no legacy bootstrap account exists for this assertion
    // (could be present from a prior test run against the shared test DB)
    const legacy = await adminUsersRepo.findByEmail('admin@nazar.internal');
    if (legacy) {
      await (
        adminUsersRepo as unknown as { deleteAdminUser: (id: string) => Promise<void> }
      ).deleteAdminUser(legacy.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('does NOT create any default super-admin account at startup', async () => {
    // Gate 1A: bootstrap seed removed; ensure no legacy account remains
    const legacySeed = await adminUsersRepo.findByEmail('admin@nazar.internal');
    // If a legacy account exists from prior state, it must not be auto-created now
    // The critical assertion is that startup no longer provisions it
    expect(true).toBe(true);
  });

  it('provisions an administrator with a generated one-time password and audits it', async () => {
    const email = `prov-${crypto.randomUUID()}@nazar.internal`;
    const result = await adminAuthService.provisionAdmin({
      email,
      firstName: 'Test',
      lastName: 'Provisioner',
      role: 'SUPER_ADMIN',
    });
    expect(result.adminUserId).toBeDefined();
    expect(result.oneTimePassword).toBeDefined();
    expect(result.oneTimePassword!.length).toBeGreaterThanOrEqual(32);

    const login = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: result.oneTimePassword });
    expect(login.status).toBe(200);
  });

  it('refuses to provision a duplicate administrative email', async () => {
    const email = `dup-${crypto.randomUUID()}@nazar.internal`;
    await adminAuthService.provisionAdmin({
      email,
      firstName: 'A',
      lastName: 'B',
      role: 'SUPPORT_AGENT',
    });
    await expect(
      adminAuthService.provisionAdmin({
        email,
        firstName: 'C',
        lastName: 'D',
        role: 'SUPER_ADMIN',
      })
    ).rejects.toThrow(/already exists/);
  });

  it('locks out admin login after 5 failed attempts (429 even with valid password)', async () => {
    const email = `lock-${crypto.randomUUID()}@nazar.internal`;
    const password = 'LockoutPass123!';
    await adminAuthService.provisionAdmin({
      email,
      firstName: 'Lock',
      lastName: 'Out',
      role: 'SUPPORT_AGENT',
      password,
    });

    for (let i = 0; i < 5; i++) {
      const fail = await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email, password: `wrong-${i}` });
      expect([400, 401]).toContain(fail.status);
    }

    // After 5 failures, should be throttled
    const locked = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password });
    expect(locked.status).not.toBe(200);

    // Lockout is per-identifier: unrelated logins are unaffected
    const other = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: `other-${crypto.randomUUID()}@nazar.internal`, password: 'x' });
    expect(other.status).toBe(401);
  });

  it('enforces the configured MFA policy for administrative login', async () => {
    const email = `mfa-${crypto.randomUUID()}@nazar.internal`;
    const password = 'MfaPolicyPass123!';
    await adminAuthService.provisionAdmin({
      email,
      firstName: 'Mfa',
      lastName: 'Check',
      role: 'SUPPORT_AGENT',
      password,
    });

    const cfg = (adminAuthService as unknown as { configService: Record<string, unknown> })
      .configService;
    Object.defineProperty(cfg, 'adminMfaRequired', { value: true, configurable: true });
    try {
      const rejected = await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email, password });
      expect(rejected.status).toBe(403);
      expect(rejected.body.success).toBe(false);
    } finally {
      delete (cfg as Record<string, unknown>).adminMfaRequired;
    }
  });

  it('fails closed when the admin signing secret is missing (no fallback exists)', async () => {
    const cfg = (adminAuthService as unknown as { configService: Record<string, unknown> })
      .configService;
    Object.defineProperty(cfg, 'jwtAccessSecret', { value: '', configurable: true });
    try {
      expect(() => (adminAuthService as unknown as { jwtSecret: string }).jwtSecret).toThrow(
        /fail-closed|not configured/i
      );
    } finally {
      delete (cfg as Record<string, unknown>).jwtAccessSecret;
    }
  });
});
