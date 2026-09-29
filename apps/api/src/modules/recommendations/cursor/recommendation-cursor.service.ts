import { Injectable, BadRequestException } from '@nestjs/common';
import {
  ErrorCode,
  type RecommendationCursorPayload,
  type RecommendationMode,
} from '@platform/api-contracts';

export const RECOMMENDATION_CURSOR_SERVICE_TOKEN = Symbol('RECOMMENDATION_CURSOR_SERVICE_TOKEN');

export interface IRecommendationCursorService {
  encode(payload: RecommendationCursorPayload): string;
  decode(cursorStr: string): RecommendationCursorPayload;
}

@Injectable()
export class RecommendationCursorService implements IRecommendationCursorService {
  encode(payload: RecommendationCursorPayload): string {
    const raw = JSON.stringify({
      m: payload.mode,
      v: payload.version,
      s: payload.lastScore,
      id: payload.lastId,
      t: payload.timestamp,
    });
    return Buffer.from(raw, 'utf8').toString('base64url');
  }

  decode(cursorStr: string): RecommendationCursorPayload {
    try {
      const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed.m !== 'string' ||
        typeof parsed.v !== 'string' ||
        typeof parsed.s !== 'number' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.t !== 'number'
      ) {
        throw new Error('Invalid cursor schema');
      }

      return {
        mode: parsed.m as RecommendationMode,
        version: parsed.v,
        lastScore: parsed.s,
        lastId: parsed.id,
        timestamp: parsed.t,
      };
    } catch {
      throw new BadRequestException({
        statusCode: 400,
        code: ErrorCode.RECOMMENDATION_CURSOR_INVALID,
        message: 'Invalid or malformed recommendation pagination cursor',
      });
    }
  }
}
