import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@platform/api-contracts';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { AdminAuthService } from '../services/admin-auth.service.js';
import { AdminSessionsRepository } from '../repositories/admin-sessions.repository.js';
import { AdminUsersRepository } from '../repositories/admin-users.repository.js';
import type { AuthenticatedAdminPrincipal } from '../decorators/current-admin.decorator.js';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AdminAuthService)
    private readonly adminAuthService: AdminAuthService,
    @Inject(AdminSessionsRepository)
    private readonly adminSessionsRepo: AdminSessionsRepository,
    @Inject(AdminUsersRepository)
    private readonly adminUsersRepo: AdminUsersRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message:
          'Missing or malformed Authorization header for admin operation. Bearer token required.',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Admin bearer token cannot be empty',
      });
    }

    // 1. Verify token claims and scope
    const payload = await this.adminAuthService.verifyAccessToken(token);

    // 2. Verify durable session state in admin_sessions
    const session = await this.adminSessionsRepo.findById(payload.sid);
    if (!session) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Admin session does not exist',
      });
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_REVOKED,
        message: 'Admin session has been revoked',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Admin session has expired',
      });
    }

    // 3. Verify admin account active status
    const adminUser = await this.adminUsersRepo.findById(payload.sub);
    if (!adminUser || !adminUser.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Administrative staff account is inactive or disabled',
      });
    }

    // Update session last active time asynchronously
    void this.adminSessionsRepo.updateLastActive(session.id, new Date()).catch(() => {});

    // Refresh current roles & permissions from DB to prevent stale permissions
    const roles = await this.adminUsersRepo.getUserRoles(adminUser.id);
    const permissions = await this.adminUsersRepo.getUserPermissions(adminUser.id);

    // 4. Attach principal to request
    const principal: AuthenticatedAdminPrincipal = {
      adminId: adminUser.id,
      sessionId: session.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      roles,
      permissions,
    };

    request.admin = principal;
    return true;
  }
}
