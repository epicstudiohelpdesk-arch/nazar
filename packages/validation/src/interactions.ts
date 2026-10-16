import { z } from 'zod';
import { uuidV7Schema } from './uuid.js';

export const interactionTargetParamSchema = z.object({
  targetUserId: uuidV7Schema,
});

export type InteractionTargetParamInput = z.infer<typeof interactionTargetParamSchema>;

export const targetAttachmentTypeSchema = z.enum(['PROFILE', 'MEDIA', 'PROMPT']);

export const likeInteractionBodySchema = z.object({
  targetAttachmentType: targetAttachmentTypeSchema.optional().default('PROFILE'),
  targetAttachmentId: uuidV7Schema.optional(),
  comment: z.string().trim().max(280, 'Comment must not exceed 280 characters').optional(),
});

export type LikeInteractionInput = z.infer<typeof likeInteractionBodySchema>;
