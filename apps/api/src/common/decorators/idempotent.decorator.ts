import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'isIdempotent';
export const Idempotent = (options: { ttlSeconds?: number } = {}) =>
  SetMetadata(IDEMPOTENT_KEY, { required: true, ttlSeconds: options.ttlSeconds ?? 86400 });
