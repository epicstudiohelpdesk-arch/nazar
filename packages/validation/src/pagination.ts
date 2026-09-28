import { z } from 'zod';

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export type CursorPaginationQueryInput = z.infer<typeof cursorPaginationQuerySchema>;
