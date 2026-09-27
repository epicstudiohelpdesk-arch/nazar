import { z } from "zod";

export const cursorPaginationQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Opaque cursor pointing to the last evaluated item from previous page",
    ),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20)
    .describe("Number of items to fetch (1-100, default 20)"),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

export function createCursorPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    totalCount: z.number().int().nonnegative().optional(),
  });
}

/**
 * Standard cursor payload for UUIDv7 or timestamp-ordered collections
 */
export interface DefaultCursorPayload {
  id: string;
  createdAtMs: number;
}

/**
 * Helper to encode an opaque base64 cursor
 */
export function encodeCursor(payload: DefaultCursorPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64url");
  }
  return btoa(json);
}

/**
 * Helper to decode an opaque base64 cursor
 */
export function decodeCursor(cursor: string): DefaultCursorPayload | null {
  try {
    let json = "";
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(cursor, "base64url").toString("utf-8");
    } else {
      json = atob(cursor);
    }
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.createdAtMs === "number"
    ) {
      return parsed as DefaultCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
