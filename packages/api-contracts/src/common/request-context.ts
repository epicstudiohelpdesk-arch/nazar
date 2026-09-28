export const HEADER_REQUEST_ID = 'x-request-id';
export const HEADER_IDEMPOTENCY_KEY = 'idempotency-key';
export const HEADER_API_VERSION = 'x-api-version';

export interface RequestContext {
  readonly requestId: string;
  readonly timestamp: number;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly path?: string;
  readonly method?: string;
}
