import { z } from 'zod';
import { uuidSchema } from './chat.js';

export const CANONICAL_EVENT_NAME_REGEX = /^[a-z]+(\.[a-z0-9_]+)+$/;

export const PROHIBITED_ANALYTICS_PROPERTY_NAMES = [
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'otp',
  'code',
  'cardnumber',
  'card_number',
  'cvv',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'messagetext',
  'content',
  'body',
] as const;

/**
 * Property validator ensuring bounded depth, safe keys, and secret exclusion.
 */
export const analyticsPropertiesSchema = z
  .record(z.unknown())
  .refine((props) => Object.keys(props).length <= 30, {
    message: 'Event properties must not exceed 30 keys',
  })
  .refine(
    (props) => {
      const keys = Object.keys(props);
      for (const key of keys) {
        const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
        if (PROHIBITED_ANALYTICS_PROPERTY_NAMES.some((p) => normalized.includes(p))) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Event properties contain prohibited sensitive field names (passwords, tokens, exact coords, or raw message text)',
    }
  );

/**
 * Single Analytics Client Event Ingestion Item Schema
 */
export const analyticsClientEventItemSchema = z.object({
  eventId: uuidSchema,
  eventName: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(
      CANONICAL_EVENT_NAME_REGEX,
      'Event name must follow canonical namespace pattern (e.g. domain.action)'
    ),
  eventVersion: z.coerce.number().int().min(1).max(100).default(1),
  occurredAt: z.string().datetime({ message: 'occurredAt must be a valid ISO 8601 timestamp' }),
  anonymousId: z.string().trim().max(64).optional(),
  deviceId: z.string().trim().max(64).optional(),
  platform: z.enum(['ios', 'android', 'web', 'backend']).optional(),
  appVersion: z.string().trim().max(32).optional(),
  locale: z.string().trim().max(16).optional(),
  properties: analyticsPropertiesSchema.default({}),
  context: z.record(z.unknown()).optional(),
});

export type AnalyticsClientEventItemInput = z.infer<typeof analyticsClientEventItemSchema>;

/**
 * Batch Ingestion Schema (Bounded to max 50 events per batch)
 */
export const ingestAnalyticsEventsSchema = z.object({
  events: z
    .array(analyticsClientEventItemSchema)
    .min(1, 'Events batch must contain at least 1 event')
    .max(50, 'Events batch must not exceed 50 events'),
});

export type IngestAnalyticsEventsInput = z.infer<typeof ingestAnalyticsEventsSchema>;

/**
 * Daily Metrics Query Schema
 */
export const dailyMetricsQuerySchema = z.object({
  metricNames: z.union([z.string().transform((v) => [v]), z.array(z.string())]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
  dimension: z.string().trim().max(64).optional(),
});

export type DailyMetricsQueryInput = z.infer<typeof dailyMetricsQuerySchema>;

/**
 * Funnel Query Schema
 */
export const funnelQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
  platform: z.string().trim().max(32).optional(),
});

export type FunnelQueryInput = z.infer<typeof funnelQuerySchema>;

/**
 * Retention Cohort Query Schema
 */
export const retentionQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
    .optional(),
  limit: z.coerce.number().int().min(1).max(90).default(30).optional(),
});

export type RetentionQueryInput = z.infer<typeof retentionQuerySchema>;

/**
 * Experiment Exposure Ingestion Schema
 */
export const recordExperimentExposureSchema = z.object({
  experimentId: z.string().trim().min(1).max(64),
  subjectId: z.string().trim().min(1).max(128),
  variant: z.string().trim().min(1).max(32),
  properties: z.record(z.unknown()).optional(),
});

export type RecordExperimentExposureInput = z.infer<typeof recordExperimentExposureSchema>;
