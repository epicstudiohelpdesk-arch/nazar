import type { ApiErrorResponse } from './errors.js';

export interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ApiFailureEnvelope {
  readonly success: false;
  readonly error: ApiErrorResponse;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export function createSuccessResponse<T>(
  data: T,
  meta?: Readonly<Record<string, unknown>>
): ApiSuccessEnvelope<T> {
  return meta !== undefined ? { success: true, data, meta } : { success: true, data };
}

export function createFailureResponse(error: ApiErrorResponse): ApiFailureEnvelope {
  return {
    success: false,
    error,
  };
}
