import type { DiscoveryCursorPayload } from '../domain/discovery.types.js';

export interface IDiscoveryCursorService {
  encode(score: number, id: string): string;
  decode(cursor: string): DiscoveryCursorPayload;
}

export const DISCOVERY_CURSOR_SERVICE_TOKEN = Symbol('IDiscoveryCursorService');
