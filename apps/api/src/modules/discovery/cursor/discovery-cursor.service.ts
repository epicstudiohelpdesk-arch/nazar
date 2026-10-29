import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import type { DiscoveryCursorPayload } from '../domain/discovery.types.js';
import type { IDiscoveryCursorService } from './discovery-cursor.interface.js';

interface RawWireCursor {
  v: number;
  s: number;
  id: string;
  sig: string;
}

@Injectable()
export class DiscoveryCursorService implements IDiscoveryCursorService {
  private readonly secret: string;

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {
    // Gate 1A: the hard-coded fallback secret was removed. Cursor signing is
    // bound to the validated JWT access secret (environment validation rejects
    // development defaults outside development/test) and fails closed if absent.
    this.secret = this.configService.jwtAccessSecret;
    if (!this.secret) {
      throw new Error(
        '[SECURITY] JWT_ACCESS_SECRET is not configured; discovery cursor signing is disabled (fail-closed).'
      );
    }
  }

  encode(score: number, id: string): string {
    const roundedScore = Math.round(score * 10000) / 10000;
    const sig = this.computeSignature(1, roundedScore, id);

    const wire: RawWireCursor = {
      v: 1,
      s: roundedScore,
      id,
      sig,
    };

    const json = JSON.stringify(wire);
    return Buffer.from(json, 'utf-8').toString('base64url');
  }

  decode(cursor: string): DiscoveryCursorPayload {
    if (!cursor || typeof cursor !== 'string') {
      throw new BadRequestException({
        code: ErrorCode.DISCOVERY_INVALID_CURSOR,
        message: 'Cursor must be a non-empty string',
      });
    }

    if (cursor.length > 512) {
      throw new BadRequestException({
        code: ErrorCode.DISCOVERY_INVALID_CURSOR,
        message: 'Cursor exceeds maximum allowable length',
      });
    }

    try {
      const decodedJson = Buffer.from(cursor, 'base64url').toString('utf-8');
      const raw = JSON.parse(decodedJson) as unknown;

      if (!raw || typeof raw !== 'object') {
        throw new Error('Not an object');
      }

      const wire = raw as Partial<RawWireCursor>;

      if (wire.v !== 1) {
        throw new Error('Unsupported cursor version');
      }

      if (typeof wire.s !== 'number' || !Number.isFinite(wire.s) || wire.s < 0 || wire.s > 1) {
        throw new Error('Invalid score in cursor');
      }

      if (
        typeof wire.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wire.id)
      ) {
        throw new Error('Invalid profile ID in cursor');
      }

      if (typeof wire.sig !== 'string' || wire.sig.length === 0) {
        throw new Error('Missing cursor signature');
      }

      // Verify HMAC integrity
      const expectedSig = this.computeSignature(wire.v, wire.s, wire.id);
      const isSigValid =
        wire.sig.length === expectedSig.length &&
        crypto.timingSafeEqual(Buffer.from(wire.sig), Buffer.from(expectedSig));

      if (!isSigValid) {
        throw new Error('Cursor signature verification failed');
      }

      return {
        v: 1,
        score: wire.s,
        id: wire.id,
      };
    } catch {
      throw new BadRequestException({
        code: ErrorCode.DISCOVERY_INVALID_CURSOR,
        message: 'Invalid, expired, or tampered discovery cursor provided',
      });
    }
  }

  private computeSignature(version: number, score: number, id: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`v${version}:${score.toFixed(4)}:${id}`)
      .digest('hex')
      .slice(0, 16);
  }
}
