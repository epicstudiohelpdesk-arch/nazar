import type { ApiErrorResponse } from './errors.js';

export interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly requestId: string;
}

export interface ApiPaginationMeta {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount?: number;
}

export interface ApiPaginatedEnvelope<T> {
  readonly success: true;
  readonly data: readonly T[];
  readonly pagination: ApiPaginationMeta;
  readonly requestId: string;
}

export interface ApiFailureEnvelope {
  readonly success: false;
  readonly error: ApiErrorResponse;
  readonly requestId: string;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  meta?: Readonly<Record<string, unknown>>
): ApiSuccessEnvelope<T> {
  return meta !== undefined
    ? { success: true, data, meta, requestId }
    : { success: true, data, requestId };
}

export function createPaginatedResponse<T>(
  data: readonly T[],
  pagination: ApiPaginationMeta,
  requestId: string
): ApiPaginatedEnvelope<T> {
  return {
    success: true,
    data,
    pagination,
    requestId,
  };
}

export function createFailureResponse(
  error: ApiErrorResponse,
  requestId: string
): ApiFailureEnvelope {
  return {
    success: false,
    error,
    requestId,
  };
}
