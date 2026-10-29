import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import { AdminUsersRepository } from '../repositories/admin-users.repository.js';
import { AdminSessionsRepository } from '../repositories/admin-sessions.repository.js';
import { AdminRolesRepository } from '../repositories/admin-roles.repository.js';
import { AdminAuditLogsRepository } from '../repositories/admin-audit-logs.repository.js';
import { ADMIN_TOKEN_EXPIRATION_SECONDS } from '../constants/admin.constants.js';
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminProfileDto,
  AdminSessionDto,
  AdminRoleName,
  AdminPermissionName,
} from '@platform/api-contracts';

// Valid-format scrypt digest used to equalize response timing when an
// administrative email does not exist (anti-enumeration). Contains no secret.
const DUMMY_PASSWORD_HASH = crypto
  .scryptSync(crypto.randomBytes(16), crypto.randomBytes(16), 64)
  .toString('hex');
const DUMMY_STORED_HASH = `scrypt:${'00'.repeat(16)}:${DUMMY_PASSWORD_HASH}`;

const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

interface LoginThrottleState {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
}

export interface AdminTokenPayload {
  readonly sub: string;
  readonly sid: string;
  readonly email: string;
  readonly scope: 'admin';
  readonly roles: readonly AdminRoleName[];
  readonly permissions: readonly AdminPermissionName[];
  readonly iat?: number;
  readonly exp?: number;
  readonly iss?: string;
  readonly aud?: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(AdminUsersRepository)
    private readonly adminUsersRepo: AdminUsersRepository,
    @Inject(AdminSessionsRepository)
    private readonly adminSessionsRepo: AdminSessionsRepository,
    @Inject(AdminRolesRepository)
    private readonly adminRolesRepo: AdminRolesRepository,
    @Inject(AdminAuditLogsRepository)
    private readonly adminAuditLogsRepo: AdminAuditLogsRepository
  ) {}

  /**
   * Gate 1A: administrative tokens are signed exclusively with the validated
   * JWT access secret. There is no hard-coded fallback; missing secret fails
   * closed. Environment validation rejects development defaults outside
   * development/test at startup.
   */
  private get jwtSecret(): string {
    const secret = this.configService.jwtAccessSecret;
    if (!secret) {
      throw new Error(
        '[SECURITY] JWT_ACCESS_SECRET is not configured. Administrative token signing is disabled (fail-closed).'
      );
    }
    return secret;
  }

  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1]!;
    const expectedHash = parts[2]!;
    const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');

    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(actualHash, 'hex');

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  generateTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Gate 1A: dedicated, in-memory admin login throttling (per email).
   * Limits both online password guessing and email enumeration. Note: this is
   * per-instance state; distributed brute-force resistance across replicas is
   * deferred to the shared-rate-limit work tracked in Gate 1B.
   */
  private readonly loginThrottle = new Map<string, LoginThrottleState>();

  private assertLoginNotLocked(email: string): void {
    const state = this.loginThrottle.get(email);
    if (state && state.lockedUntil > Date.now()) {
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMITED,
          message: 'Too many failed administrative login attempts. Access temporarily locked.',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private recordLoginFailure(email: string): void {
    const now = Date.now();
    const state = this.loginThrottle.get(email);
    if (!state || now - state.windowStartedAt > LOGIN_FAILURE_WINDOW_MS) {
      this.loginThrottle.set(email, { failures: 1, windowStartedAt: now, lockedUntil: 0 });
      return;
    }
    state.failures += 1;
    if (state.failures >= LOGIN_MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = now + LOGIN_LOCKOUT_MS;
    }
  }

  private recordLoginSuccess(email: string): void {
    this.loginThrottle.delete(email);
  }

  async login(
    input: AdminLoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminLoginResponse> {
    const throttleKey = String(input.email || '')
      .trim()
      .toLowerCase();
    this.assertLoginNotLocked(throttleKey);

    const adminUser = await this.adminUsersRepo.findByEmail(input.email);
    if (!adminUser) {
      // Equalize timing with a real password verification (anti-enumeration)
      this.verifyPassword(input.password, DUMMY_STORED_HASH);
      this.recordLoginFailure(throttleKey);
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid administrative email or password',
      });
    }

    if (!adminUser.isActive) {
      this.recordLoginFailure(throttleKey);
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Administrative staff account is deactivated',
      });
    }

    const isValid = this.verifyPassword(input.password, adminUser.passwordHash);
    if (!isValid) {
      this.recordLoginFailure(throttleKey);
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid administrative email or password',
      });
    }

    // Gate 1A: enforce the configured MFA policy for privileged administrators.
    // Defaults to enforced in staging/production. Until TOTP enrollment ships
    // (Gate 1B), non-MFA administrators cannot establish sessions when the
    // policy is active — fail closed rather than silent exposure.
    if (this.configService.adminMfaRequired && !adminUser.mfaEnabled) {
      this.recordLoginFailure(throttleKey);
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message:
          'Multi-factor authentication is required for administrative accounts. This account has not completed MFA enrollment.',
      });
    }

    this.recordLoginSuccess(throttleKey);

    // Load roles and permissions
    const roles = await this.adminUsersRepo.getUserRoles(adminUser.id);
    const permissions = await this.adminUsersRepo.getUserPermissions(adminUser.id);

    // Create session in admin_sessions
    const sessionId = crypto.randomUUID();
    const tokenBytes = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.generateTokenHash(tokenBytes);
    const expiresAt = new Date(Date.now() + ADMIN_TOKEN_EXPIRATION_SECONDS * 1000);

    await this.adminSessionsRepo.createSession({
      id: sessionId,
      adminUserId: adminUser.id,
      tokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
      lastActiveAt: new Date(),
    });

    await this.adminUsersRepo.updateLastLogin(adminUser.id, new Date());

    // Generate signed JWT
    const payload: AdminTokenPayload = {
      sub: adminUser.id,
      sid: sessionId,
      email: adminUser.email,
      scope: 'admin',
      roles,
      permissions,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: ADMIN_TOKEN_EXPIRATION_SECONDS,
      issuer: this.configService.jwtIssuer,
      audience: this.configService.jwtAudience,
    });

    const adminProfile: AdminProfileDto = {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      isActive: adminUser.isActive,
      mfaEnabled: adminUser.mfaEnabled,
      roles,
      permissions,
      lastLoginAt: adminUser.lastLoginAt ? adminUser.lastLoginAt.toISOString() : null,
      createdAt: adminUser.createdAt.toISOString(),
    };

    return {
      accessToken,
      expiresIn: ADMIN_TOKEN_EXPIRATION_SECONDS,
      admin: adminProfile,
      sessionId,
    };
  }

  async verifyAccessToken(token: string): Promise<AdminTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      }) as jwt.JwtPayload;

      if (!decoded.sub || !decoded['sid'] || decoded['scope'] !== 'admin') {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Invalid administrative token claims or scope',
        });
      }

      return {
        sub: decoded.sub,
        sid: decoded['sid'] as string,
        email: (decoded['email'] as string) || '',
        scope: 'admin',
        roles: (decoded['roles'] as AdminRoleName[]) || [],
        permissions: (decoded['permissions'] as AdminPermissionName[]) || [],
        iat: decoded.iat,
        exp: decoded.exp,
        iss: decoded.iss,
        aud: typeof decoded.aud === 'string' ? decoded.aud : decoded.aud?.[0],
      };
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Administrative session token has expired',
        });
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Invalid administrative token signature',
        });
      }
      throw err;
    }
  }

  async getAdminProfile(adminUserId: string): Promise<AdminProfileDto> {
    const adminUser = await this.adminUsersRepo.findById(adminUserId);
    if (!adminUser) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Admin user not found',
      });
    }

    const roles = await this.adminUsersRepo.getUserRoles(adminUser.id);
    const permissions = await this.adminUsersRepo.getUserPermissions(adminUser.id);

    return {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      isActive: adminUser.isActive,
      mfaEnabled: adminUser.mfaEnabled,
      roles,
      permissions,
      lastLoginAt: adminUser.lastLoginAt ? adminUser.lastLoginAt.toISOString() : null,
      createdAt: adminUser.createdAt.toISOString(),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.adminSessionsRepo.revokeSession(sessionId, 'ADMIN_LOGOUT');
  }

  async logoutAll(adminUserId: string): Promise<void> {
    await this.adminSessionsRepo.revokeAllForAdmin(adminUserId, 'ADMIN_REVOKE_ALL');
  }

  async getActiveSessions(
    adminUserId: string,
    currentSessionId: string
  ): Promise<AdminSessionDto[]> {
    const rows = await this.adminSessionsRepo.findActiveSessionsForAdmin(adminUserId);
    return rows.map((r) => ({
      id: r.id,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      expiresAt: r.expiresAt.toISOString(),
      lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      isCurrent: r.id === currentSessionId,
    }));
  }

  /**
   * Gate 1A: initializes the baseline role/permission definitions only.
   * This creates NO user accounts and is safe to invoke at startup or in tests.
   */
  async ensureDefaultRolesAndPermissions(): Promise<void> {
    await this.adminRolesRepo.ensureDefaultRolesAndPermissions();
  }

  /**
   * Gate 1A: auditable, explicit administrator provisioning.
   *
   * Replaces the removed boot-time seed that created `admin@nazar.internal`
   * with a hard-coded password in every environment. There are no default
   * credentials: when no password is supplied, a cryptographically random
   * one-time password is generated and returned to the operator exactly once
   * (never persisted in plaintext, never logged by this method).
   *
   * Fail-closed: in staging/production, provisioning is refused unless an
   * operator-configured ADMIN_PROVISIONING_TOKEN exists (the CLI additionally
   * requires the operator to present that token).
   */
  async provisionAdmin(input: {
    email: string;
    firstName: string;
    lastName: string;
    role: AdminRoleName;
    password?: string;
    mfaEnabled?: boolean;
  }): Promise<{
    adminUserId: string;
    email: string;
    role: AdminRoleName;
    oneTimePassword?: string;
  }> {
    const hardenedEnv =
      this.configService.nodeEnv === 'staging' || this.configService.nodeEnv === 'production';

    if (hardenedEnv && !this.configService.adminProvisioningToken) {
      throw new Error(
        '[SECURITY] Administrator provisioning is disabled: ADMIN_PROVISIONING_TOKEN is not configured for this environment.'
      );
    }

    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      throw new Error('Administrator provisioning requires an email address.');
    }

    // Ensure RBAC definitions exist before assigning a role
    await this.adminRolesRepo.ensureDefaultRolesAndPermissions();

    const existing = await this.adminUsersRepo.findByEmail(email);
    if (existing) {
      throw new Error(
        `Administrator provisioning refused: an administrative account already exists for ${email}.`
      );
    }

    const oneTimePassword = input.password ?? crypto.randomBytes(24).toString('base64url');
    const adminUserId = crypto.randomUUID();

    await this.adminUsersRepo.createAdminUser({
      id: adminUserId,
      email,
      passwordHash: this.hashPassword(oneTimePassword),
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
      mfaEnabled: input.mfaEnabled ?? false,
    });
    await this.adminUsersRepo.assignRole(adminUserId, input.role);

    // Durable audit trail for the privileged change (no credential material)
    await this.adminAuditLogsRepo.createLog({
      id: crypto.randomUUID(),
      actorAdminId: null,
      actorEmail: 'system:admin-provisioning',
      actorRole: 'SYSTEM',
      action: 'ADMIN_PROVISIONED',
      resourceType: 'admin_user',
      resourceId: adminUserId,
      reason: 'Explicit administrator provisioning (Gate 1A workflow)',
      newState: { email, role: input.role, mfaEnabled: input.mfaEnabled ?? false },
    });

    return {
      adminUserId,
      email,
      role: input.role,
      oneTimePassword: input.password ? undefined : oneTimePassword,
    };
  }
}
