import { Injectable, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import { AdminUsersRepository } from '../repositories/admin-users.repository.js';
import { AdminSessionsRepository } from '../repositories/admin-sessions.repository.js';
import { AdminRolesRepository } from '../repositories/admin-roles.repository.js';
import {
  ADMIN_TOKEN_EXPIRATION_SECONDS,
  ADMIN_JWT_SECRET_FALLBACK,
} from '../constants/admin.constants.js';
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminProfileDto,
  AdminSessionDto,
  AdminRoleName,
  AdminPermissionName,
} from '@platform/api-contracts';

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
    private readonly adminRolesRepo: AdminRolesRepository
  ) {}

  private get jwtSecret(): string {
    return this.configService.jwtAccessSecret || ADMIN_JWT_SECRET_FALLBACK;
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

  async login(
    input: AdminLoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminLoginResponse> {
    const adminUser = await this.adminUsersRepo.findByEmail(input.email);
    if (!adminUser) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid administrative email or password',
      });
    }

    if (!adminUser.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Administrative staff account is deactivated',
      });
    }

    const isValid = this.verifyPassword(input.password, adminUser.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid administrative email or password',
      });
    }

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
   * Automatically initializes the default roles, permissions, and initial super admin staff user if needed.
   */
  async ensureSeedAdmin(): Promise<void> {
    await this.adminRolesRepo.ensureDefaultRolesAndPermissions();

    const existingAdmin = await this.adminUsersRepo.findByEmail('admin@nazar.internal');
    if (!existingAdmin) {
      const adminId = crypto.randomUUID();
      const passwordHash = this.hashPassword('SuperAdmin123!');
      await this.adminUsersRepo.createAdminUser({
        id: adminId,
        email: 'admin@nazar.internal',
        passwordHash,
        firstName: 'System',
        lastName: 'SuperAdmin',
        isActive: true,
        mfaEnabled: false,
      });

      await this.adminUsersRepo.assignRole(adminId, 'SUPER_ADMIN');
    }
  }
}
