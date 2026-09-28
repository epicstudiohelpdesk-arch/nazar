import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from '@platform/api-contracts';

@Injectable()
export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  static get current(): RequestContext | undefined {
    return RequestContextService.storage.getStore();
  }

  static get currentRequestId(): string {
    return RequestContextService.storage.getStore()?.requestId ?? 'unknown-request-id';
  }

  run<R>(context: RequestContext, fn: () => R): R {
    return RequestContextService.storage.run(context, fn);
  }

  getContext(): RequestContext | undefined {
    return RequestContextService.current;
  }

  getRequestId(): string {
    return RequestContextService.currentRequestId;
  }
}
