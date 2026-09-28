export interface CursorPaginationQuery {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CursorPaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount?: number;
}

export interface DefaultCursorPayload {
  readonly id: string;
  readonly createdAtMs: number;
}

export function encodeCursor(payload: DefaultCursorPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf-8').toString('base64url');
  }
  return btoa(json);
}

export function decodeCursor(cursor: string): DefaultCursorPayload | null {
  try {
    let json = '';
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(cursor, 'base64url').toString('utf-8');
    } else {
      json = atob(cursor);
    }
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'createdAtMs' in parsed &&
      typeof (parsed as { id: unknown }).id === 'string' &&
      typeof (parsed as { createdAtMs: unknown }).createdAtMs === 'number'
    ) {
      return parsed as DefaultCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
