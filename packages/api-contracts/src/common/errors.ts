/**
 * Standard Application and API Error Codes
 * These codes form the canonical contract with mobile, web, and external clients.
 */
export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  INVALID_STATE = 'INVALID_STATE',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REPLAY_DETECTED = 'TOKEN_REPLAY_DETECTED',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export interface FieldValidationError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}

export interface ApiErrorResponse {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: readonly FieldValidationError[];
  readonly path?: string;
  readonly timestamp: string;
}
