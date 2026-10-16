import { z } from 'zod';
import { uuidV7Schema } from './uuid.js';

export const matchIdParamSchema = z.object({
  matchId: uuidV7Schema,
});

export type MatchIdParamInput = z.infer<typeof matchIdParamSchema>;

export const matchListQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
  cursor: z
    .string()
    .trim()
    .min(1, 'Cursor cannot be empty')
    .max(512, 'Cursor exceeds maximum length')
    .optional(),
});

export type MatchListQueryInput = z.infer<typeof matchListQuerySchema>;

export const unmatchRequestSchema = z.object({
  reason: z.string().trim().max(256, 'Unmatch reason cannot exceed 256 characters').optional(),
});

export type UnmatchRequestInput = z.infer<typeof unmatchRequestSchema>;

export const postDateFeedbackSchema = z.object({
  didMeet: z.boolean(),
  wouldSeeAgain: z.boolean().optional(),
  sentimentTags: z
    .array(z.string().trim().min(1).max(64))
    .max(10, 'Cannot exceed 10 sentiment tags')
    .optional(),
  privateNotes: z
    .string()
    .trim()
    .max(1000, 'Private notes cannot exceed 1000 characters')
    .optional(),
  closeMatch: z.boolean().optional().default(false),
});

export type PostDateFeedbackInput = z.infer<typeof postDateFeedbackSchema>;
