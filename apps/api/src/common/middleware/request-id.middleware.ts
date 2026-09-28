import { Injectable, Inject, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { generateUuidV7 } from '@platform/domain';
import { HEADER_REQUEST_ID, type RequestContext } from '@platform/api-contracts';
import { RequestContextService } from '../context/request-context.service.js';

const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const headerValue = req.headers[HEADER_REQUEST_ID];
    let requestId: string;

    if (typeof headerValue === 'string' && VALID_REQUEST_ID_REGEX.test(headerValue)) {
      requestId = headerValue;
    } else {
      requestId = generateUuidV7();
    }

    // Attach to Request object and outgoing Response header
    req.headers[HEADER_REQUEST_ID] = requestId;
    (req as Request & { id: string }).id = requestId;
    res.setHeader(HEADER_REQUEST_ID, requestId);

    const context: RequestContext = {
      requestId,
      timestamp: Date.now(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.originalUrl || req.url,
      method: req.method,
    };

    this.contextService.run(context, () => {
      next();
    });
  }
}
