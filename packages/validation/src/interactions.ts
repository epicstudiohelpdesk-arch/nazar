import { z } from 'zod';
import { uuidV7Schema } from './uuid.js';

export const interactionTargetParamSchema = z.object({
  targetUserId: uuidV7Schema,
});

export type InteractionTargetParamInput = z.infer<typeof interactionTargetParamSchema>;
