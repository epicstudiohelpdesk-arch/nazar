import { z } from 'zod';
import { uuidSchema } from './chat.js';

export const callTypeSchema = z.enum(['AUDIO', 'VIDEO']);

export const initiateCallSchema = z.object({
  conversationId: uuidSchema,
  callType: callTypeSchema,
});

export type InitiateCallInput = z.infer<typeof initiateCallSchema>;

export const signalTypeSchema = z.enum(['OFFER', 'ANSWER', 'ICE_CANDIDATE']);

export const callSignalSchema = z.object({
  callSessionId: uuidSchema,
  type: signalTypeSchema,
  sdp: z.string().optional().nullable(),
  candidate: z.unknown().optional().nullable(),
});

export type CallSignalInput = z.infer<typeof callSignalSchema>;

export const endCallSchema = z.object({
  callSessionId: uuidSchema,
  reason: z.string().trim().max(128).optional(),
});

export type EndCallInput = z.infer<typeof endCallSchema>;
