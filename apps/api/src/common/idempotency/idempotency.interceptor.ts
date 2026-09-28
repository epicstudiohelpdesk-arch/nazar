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
import { createHash } from 'node:crypto';
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

export function computeRequestFingerprint(req: Request): string {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url;
  const body = req.body ? JSON.stringify(req.body) : '';
  return createHash('sha256').update(`${method}:${url}:${body}`).digest('hex');
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
    const scope = (req as Request & { user?: { id?: string } }).user?.id || 'global';
    const fingerprint = computeRequestFingerprint(req);

    const existing = await this.store.get(key, scope);

    if (existing) {
      const isExpired = new Date() > new Date(existing.expiresAt);

      if (!isExpired) {
        // Enforce payload consistency: same key with different payload is a conflict
        if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
          throw new ConflictException({
            code: ErrorCode.IDEMPOTENCY_CONFLICT,
            message:
              'Idempotency key was previously used with a different request payload or endpoint',
          });
        }

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
      } else {
        // Expired record: delete old record so retry is treated as new
        await this.store.delete(key, scope);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + meta.ttlSeconds * 1000);

    const record: IdempotencyRecord = {
      key,
      scope,
      requestFingerprint: fingerprint,
      status: 'STARTED',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.store.set(record);

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.store.update(
            key,
            {
              status: 'COMPLETED',
              statusCode: res.statusCode,
              response: responseBody,
            },
            scope
          );
        },
        error: async () => {
          await this.store.update(
            key,
            {
              status: 'FAILED',
            },
            scope
          );
        },
      })
    );
  }
}
