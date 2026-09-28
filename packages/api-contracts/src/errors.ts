/**
 * Standard Application and API Error Codes
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
  readonly requestId?: string;
}
