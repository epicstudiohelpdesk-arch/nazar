import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  type ApiFailureEnvelope,
  type FieldValidationError,
  createFailureResponse,
} from '@platform/api-contracts';
import { RequestContextService } from '../context/request-context.service.js';
import { AppLoggerService } from '../logging/app-logger.service.js';
import { AppConfigService } from '../../config/app-config.service.js';

interface ErrorPayloadWithDetails {
  message?: string | string[];
  error?: string;
  code?: ErrorCode;
  details?: FieldValidationError[];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = RequestContextService.currentRequestId;
    const path = request.originalUrl || request.url;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: FieldValidationError[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resPayload = exception.getResponse();

      if (typeof resPayload === 'string') {
        message = resPayload;
      } else if (typeof resPayload === 'object' && resPayload !== null) {
        const payload = resPayload as ErrorPayloadWithDetails;
        if (Array.isArray(payload.message)) {
          message = 'Validation failed';
          details = payload.message.map((msg) => ({
            field: 'request',
            message: msg,
          }));
        } else if (payload.message) {
          message = payload.message;
        }

        if (payload.code) {
          errorCode = payload.code;
        }

        if (payload.details) {
          details = payload.details;
        }
      }

      // Map status code to standard ErrorCode if not explicitly provided
      if (errorCode === ErrorCode.INTERNAL_SERVER_ERROR || errorCode === ErrorCode.INTERNAL_ERROR) {
        errorCode = this.mapStatusToErrorCode(statusCode);
      }
    } else if (exception instanceof Error) {
      message = this.config.isProduction ? 'Internal Server Error' : 'Internal server error';
    }

    // Log the error with request ID and stack trace
    const stack = exception instanceof Error ? exception.stack : undefined;
    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${path} -> ${statusCode} (${errorCode}): ${message}`,
        stack,
        'GlobalExceptionFilter'
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${path} -> ${statusCode} (${errorCode}): ${message}`,
        'GlobalExceptionFilter'
      );
    }

    const envelope: ApiFailureEnvelope = createFailureResponse(
      {
        statusCode,
        code: errorCode,
        message,
        details,
        path,
        timestamp: new Date().toISOString(),
      },
      requestId
    );

    response.status(statusCode).json(envelope);
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.PRECONDITION_FAILED:
        return ErrorCode.PRECONDITION_FAILED;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}
