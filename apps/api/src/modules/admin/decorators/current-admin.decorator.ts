import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AdminPermissionName, AdminRoleName } from '@platform/api-contracts';

export interface AuthenticatedAdminPrincipal {
  readonly adminId: string;
  readonly sessionId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly AdminRoleName[];
  readonly permissions: readonly AdminPermissionName[];
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdminPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin as AuthenticatedAdminPrincipal;
  }
);
