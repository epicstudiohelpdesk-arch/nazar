import { z } from 'zod';
import { uuidV7Schema } from './uuid.js';

export const recommendationModeEnum = z.enum([
  'DISCOVERY',
  'PERSONALIZED_DISCOVERY',
  'SOCIAL_FEED',
  'COMMUNITY_DISCOVERY',
  'EVENT_DISCOVERY',
]);

export const recommendationQuerySchema = z.object({
  mode: recommendationModeEnum.default('PERSONALIZED_DISCOVERY'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type ValidatedRecommendationQuery = z.infer<typeof recommendationQuerySchema>;

export const recordExposureSchema = z.object({
  candidateUserId: uuidV7Schema,
  recommendationMode: recommendationModeEnum,
  recommendationVersion: z.string().min(1).max(32).default('v1'),
  featureVersion: z.string().min(1).max(32).default('v1'),
  rankPosition: z.number().int().min(1),
  score: z.number(),
  requestId: z.string().min(1).max(64),
  metadata: z.record(z.unknown()).optional(),
});

export type ValidatedRecordExposure = z.infer<typeof recordExposureSchema>;
