import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestContext } from '@platform/api-contracts';
import { RequestContextService } from '../context/request-context.service.js';

export const CurrentContext = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): RequestContext | undefined => {
    return RequestContextService.current;
  }
);
