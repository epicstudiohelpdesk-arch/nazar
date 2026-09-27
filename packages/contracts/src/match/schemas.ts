import { z } from "zod";
import { uuidV7Schema } from "../common/id.js";

export const matchSummarySchema = z.object({
  id: uuidV7Schema,
  matchedUserId: uuidV7Schema,
  matchedUserDisplayName: z.string(),
  matchedUserPhotoUrl: z.string().url().nullable(),
  matchedUserAge: z.number().int().min(18),
  isVerified: z.boolean(),
  matchedAt: z.string().datetime(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  unreadCount: z.number().int().nonnegative().default(0),
});

export type MatchSummary = z.infer<typeof matchSummarySchema>;

export const unmatchRequestSchema = z.object({
  reason: z.string().trim().max(250).optional(),
});

export type UnmatchRequest = z.infer<typeof unmatchRequestSchema>;
