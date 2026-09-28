import {
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';

export interface PgErrorLike {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
  message?: string;
}

export function extractPgError(err: unknown): PgErrorLike | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
    return err as PgErrorLike;
  }
  if (
    'cause' in err &&
    typeof (err as { cause: unknown }).cause === 'object' &&
    (err as { cause: unknown }).cause !== null
  ) {
    const cause = (err as { cause: { code?: unknown } }).cause;
    if ('code' in cause && typeof cause.code === 'string') {
      return cause as PgErrorLike;
    }
  }
  return null;
}

export function isPgError(err: unknown): err is PgErrorLike {
  return extractPgError(err) !== null;
}

/**
 * Maps database driver errors into safe HTTP application exceptions.
 * Never leaks raw SQL queries, credentials, or internal database schemas to clients.
 */
export function mapDatabaseError(err: unknown, entityName = 'resource'): HttpException {
  if (err instanceof HttpException) {
    return err;
  }

  const pgError = extractPgError(err);
  if (pgError) {
    switch (pgError.code) {
      // 23505: unique_violation
      case '23505':
        return new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `A duplicate record for ${entityName} already exists`,
        });

      // 23503: foreign_key_violation
      case '23503':
        return new BadRequestException({
          code: ErrorCode.BAD_REQUEST,
          message: `Referenced entity in ${entityName} does not exist or cannot be modified`,
        });

      // 23502: not_null_violation
      case '23502':
        return new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Required field in ${entityName} cannot be null`,
        });

      // 40001: serialization_failure (deadlock/concurrent conflict)
      case '40001':
        return new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `Concurrent transaction conflict on ${entityName}. Please retry.`,
        });

      // 08000 series: connection failure
      case '08000':
      case '08001':
      case '08003':
      case '08004':
      case '08006':
      case '57P01':
        return new ServiceUnavailableException({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Database service is temporarily unavailable. Please retry shortly.',
        });

      // 57014: statement_timeout
      case '57014':
        return new ServiceUnavailableException({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Database query timed out.',
        });
    }
  }

  return new InternalServerErrorException({
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'An unexpected database error occurred',
  });
}
