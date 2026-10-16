import { z } from 'zod';
import { uuidSchema } from './chat.js';

export const createDateCheckinSchema = z.object({
  matchId: uuidSchema,
  meetingLocation: z.string().trim().min(1, 'Meeting location is required').max(255),
  meetingAt: z.string().datetime({ message: 'Must be a valid ISO 8601 date string' }),
  checkInDeadline: z.string().datetime({ message: 'Must be a valid ISO 8601 date string' }),
  emergencyContactName: z.string().trim().min(1, 'Emergency contact name is required').max(128),
  emergencyContactPhone: z.string().trim().min(3, 'Emergency contact phone is required').max(32),
});

export type CreateDateCheckinInput = z.infer<typeof createDateCheckinSchema>;

export const triggerSosSchema = z.object({
  dateCheckinId: uuidSchema.optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type TriggerSosInput = z.infer<typeof triggerSosSchema>;
