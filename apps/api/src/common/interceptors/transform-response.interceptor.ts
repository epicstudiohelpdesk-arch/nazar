import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import {
  createSuccessResponse,
  createPaginatedResponse,
  type ApiSuccessEnvelope,
  type ApiPaginatedEnvelope,
  type ApiPaginationMeta,
} from '@platform/api-contracts';
import { RequestContextService } from '../context/request-context.service.js';

interface RawPaginatedData<T> {
  data: readonly T[];
  pagination: ApiPaginationMeta;
  meta?: Record<string, unknown>;
}

function isPaginatedPayload<T>(value: unknown): value is RawPaginatedData<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray((value as { data: unknown }).data) &&
    'pagination' in value &&
    typeof (value as { pagination: unknown }).pagination === 'object'
  );
}

function isAlreadyEnvelope(value: unknown): value is { success: boolean; requestId?: string } {
  return typeof value === 'object' && value !== null && 'success' in value;
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    // Skip Swagger documentation and raw static asset requests
    const path = req.originalUrl || req.url;
    if (path.startsWith('/docs') || path.startsWith('/favicon')) {
      return next.handle();
    }

    return next.handle().pipe(
      map(
        (data: unknown): ApiSuccessEnvelope<unknown> | ApiPaginatedEnvelope<unknown> | unknown => {
          const requestId = RequestContextService.currentRequestId;

          // If controller already returned an envelope
          if (isAlreadyEnvelope(data)) {
            if (!data.requestId) {
              return { ...data, requestId };
            }
            return data;
          }

          // If controller returned paginated data
          if (isPaginatedPayload(data)) {
            return createPaginatedResponse(data.data, data.pagination, requestId);
          }

          // Standard success wrapper
          return createSuccessResponse(data, requestId);
        }
      )
    );
  }
}
