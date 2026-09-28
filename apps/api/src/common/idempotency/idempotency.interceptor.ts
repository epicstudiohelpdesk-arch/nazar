import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { HEADER_IDEMPOTENCY_KEY, ErrorCode, type IdempotencyRecord } from '@platform/api-contracts';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator.js';
import { type IIdempotencyStore, IDEMPOTENCY_STORE_TOKEN } from './idempotency.interface.js';

interface IdempotentMetadata {
  required: boolean;
  ttlSeconds: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_STORE_TOKEN)
    private readonly store: IIdempotencyStore
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const meta = this.reflector.getAllAndOverride<IdempotentMetadata | undefined>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawKey = req.headers[HEADER_IDEMPOTENCY_KEY];
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Missing required '${HEADER_IDEMPOTENCY_KEY}' header for this mutation`,
      });
    }

    const key = rawKey.trim();
    const existing = await this.store.get(key);

    if (existing) {
      if (existing.status === 'STARTED') {
        throw new ConflictException({
          code: ErrorCode.IDEMPOTENCY_CONFLICT,
          message:
            'A mutation with this idempotency key is currently processing. Please retry shortly.',
        });
      }

      if (existing.status === 'COMPLETED' && existing.response !== undefined) {
        if (existing.statusCode) {
          res.status(existing.statusCode);
        }
        res.setHeader('x-idempotent-replayed', 'true');
        return of(existing.response);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + meta.ttlSeconds * 1000);

    const record: IdempotencyRecord = {
      key,
      status: 'STARTED',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.store.set(record);

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.store.update(key, {
            status: 'COMPLETED',
            statusCode: res.statusCode,
            response: responseBody,
          });
        },
        error: async () => {
          await this.store.update(key, {
            status: 'FAILED',
          });
        },
      })
    );
  }
}
