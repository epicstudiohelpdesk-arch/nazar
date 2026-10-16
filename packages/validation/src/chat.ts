import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const conversationIdParamSchema = z.object({
  conversationId: uuidSchema,
});

export const sendMessageSchema = z
  .object({
    clientMessageId: z
      .string()
      .trim()
      .min(1, 'Client message ID cannot be empty')
      .max(64, 'Client message ID cannot exceed 64 characters'),
    body: z.string().trim().max(2000, 'Message body cannot exceed 2000 characters').default(''),
    messageType: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'SYSTEM'] as const).default('TEXT'),
    mediaUrl: z.string().url('Invalid media URL').optional(),
    durationSeconds: z.number().int().min(1).max(300).optional(),
    waveformPeaks: z.array(z.number().min(0).max(1)).max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.messageType === 'TEXT') {
        return data.body.trim().length > 0;
      }
      if (data.messageType === 'AUDIO' || data.messageType === 'IMAGE') {
        return !!data.mediaUrl || data.body.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Message must have content or mediaUrl',
      path: ['body'],
    }
  );

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const markReadSchema = z.object({
  messageId: uuidSchema,
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

export const getMessagesQuerySchema = z.object({
  cursor: z.string().trim().min(1, 'Cursor cannot be empty').optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
});

export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;

export const getConversationsQuerySchema = z.object({
  cursor: z.string().trim().min(1, 'Cursor cannot be empty').optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
});

export type GetConversationsQueryInput = z.infer<typeof getConversationsQuerySchema>;

export const syncMessagesQuerySchema = z.object({
  sinceMessageId: uuidSchema.optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
});

export type SyncMessagesQueryInput = z.infer<typeof syncMessagesQuerySchema>;
