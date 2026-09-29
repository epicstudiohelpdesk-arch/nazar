import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type AdminPermissionName } from '@platform/api-contracts';
import { ADMIN_PERMISSIONS_KEY } from '../decorators/admin-permissions.decorator.js';
import type { AuthenticatedAdminPrincipal } from '../decorators/current-admin.decorator.js';

@Injectable()
export class AdminPermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<AdminPermissionName[]>(
      ADMIN_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin: AuthenticatedAdminPrincipal | undefined = request.admin;

    if (!admin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'No administrative context found',
      });
    }

    // Super Admin has universal access
    if (admin.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) => admin.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: `Insufficient administrative permissions. Required: ${requiredPermissions.join(', ')}`,
      });
    }

    return true;
  }
}
