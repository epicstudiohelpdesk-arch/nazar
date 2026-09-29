import { z } from 'zod';
import { uuidSchema } from './chat.js';

export const blockUserParamSchema = z.object({
  userId: uuidSchema,
});

export type BlockUserParamInput = z.infer<typeof blockUserParamSchema>;

export const blockUserBodySchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

export type BlockUserBodyInput = z.infer<typeof blockUserBodySchema>;

export const getBlockedUsersQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .min(1, 'Cursor cannot be empty')
    .optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
});

export type GetBlockedUsersQueryInput = z.infer<typeof getBlockedUsersQuerySchema>;

export const reportReasonSchema = z.enum([
  'HARASSMENT',
  'ABUSE',
  'THREATS',
  'HATE_OR_DISCRIMINATION',
  'SEXUAL_CONTENT',
  'UNWANTED_SEXUAL_BEHAVIOR',
  'SCAM_OR_FRAUD',
  'SPAM',
  'IMPERSONATION',
  'FAKE_PROFILE',
  'MINOR_SAFETY_CONCERN',
  'SELF_HARM_CONCERN',
  'VIOLENCE_OR_DANGER',
  'OFF_PLATFORM_PAYMENT_SCAM',
  'INAPPROPRIATE_CONTENT',
  'OTHER',
] as const);

export const reportTargetTypeSchema = z.enum([
  'USER',
  'PROFILE',
  'MESSAGE',
  'CONVERSATION',
  'MEDIA',
] as const);

export const createReportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: uuidSchema,
  reasonCode: reportReasonSchema,
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .nullable(),
  metadata: z
    .record(z.unknown())
    .optional()
    .nullable(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const reportIdParamSchema = z.object({
  id: uuidSchema,
});

export type ReportIdParamInput = z.infer<typeof reportIdParamSchema>;
