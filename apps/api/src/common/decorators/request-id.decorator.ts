import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { RequestContextService } from '../context/request-context.service.js';

export const RequestId = createParamDecorator((_data: unknown, _ctx: ExecutionContext): string => {
  return RequestContextService.currentRequestId;
});
