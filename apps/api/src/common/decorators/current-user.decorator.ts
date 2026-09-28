import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../guards/auth.guard.js';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedPrincipal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedPrincipal | undefined;
    return data ? user?.[data] : user;
  }
);
