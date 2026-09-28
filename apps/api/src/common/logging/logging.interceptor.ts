import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Inject,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AppLoggerService } from './app-logger.service.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const startTime = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log(`HTTP ${method} ${url} ${statusCode} - ${durationMs}ms`, 'HTTP');
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - startTime;
          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;
          this.logger.warn(
            `HTTP ${method} ${url} ${statusCode} - ${durationMs}ms (failed)`,
            'HTTP'
          );
        },
      })
    );
  }
}
