import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceIdentifier: z
    .string({ required_error: 'deviceIdentifier is required' })
    .min(1, 'deviceIdentifier cannot be empty')
    .max(256, 'deviceIdentifier cannot exceed 256 characters'),
  platform: z
    .enum(['IOS', 'ANDROID', 'ios', 'android'], {
      required_error: 'platform is required (IOS or ANDROID)',
    })
    .transform((val) => val.toUpperCase() as 'IOS' | 'ANDROID'),
  pushToken: z
    .string({ required_error: 'pushToken is required' })
    .min(1, 'pushToken cannot be empty')
    .max(1024, 'pushToken cannot exceed 1024 characters'),
  pushProvider: z
    .enum(['APNS', 'FCM', 'apns', 'fcm'])
    .optional()
    .transform((val) => (val ? (val.toUpperCase() as 'APNS' | 'FCM') : undefined)),
  appVersion: z.string().max(32).optional(),
  osVersion: z.string().max(32).optional(),
  locale: z.string().max(32).optional(),
  timezone: z.string().max(64).optional(),
});

export const updateNotificationPreferencesSchema = z
  .object({
    matchNotificationsEnabled: z.boolean().optional(),
    messageNotificationsEnabled: z.boolean().optional(),
    likeNotificationsEnabled: z.boolean().optional(),
    safetyNotificationsEnabled: z.boolean().optional(),
    systemNotificationsEnabled: z.boolean().optional(),
    messagePreviewEnabled: z.boolean().optional(),
  })
  .strict();

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
