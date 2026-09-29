import {
  pgTable,
  uuid,
  varchar,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * User Recommendation Features Table (Gate 13)
 * Stores precomputed/derived behavioral, profile, social, and quality feature snapshots.
 */
export const userRecommendationFeatures = pgTable(
  'user_recommendation_features',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    featureVersion: varchar('feature_version', { length: 32 }).notNull().default('v1'),
    features: jsonb('features').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_rec_features_computed_at').on(table.computedAt),
    index('idx_user_rec_features_version').on(table.featureVersion),
  ]
);

export type UserRecommendationFeaturesRow = typeof userRecommendationFeatures.$inferSelect;
export type NewUserRecommendationFeaturesRow = typeof userRecommendationFeatures.$inferInsert;

/**
 * Recommendation Exposures Table (Gate 13)
 * Tracks which candidates were surfaced to which viewers, at what rank, score, and model version.
 * Used for exposure frequency tracking, anti-fatigue cooldown, and model performance measurement.
 */
export const recommendationExposures = pgTable(
  'recommendation_exposures',
  {
    id: uuid('id').primaryKey(),
    viewerUserId: uuid('viewer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    candidateUserId: uuid('candidate_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recommendationMode: varchar('recommendation_mode', { length: 32 }).notNull(),
    recommendationVersion: varchar('recommendation_version', { length: 32 })
      .notNull()
      .default('v1'),
    featureVersion: varchar('feature_version', { length: 32 }).notNull().default('v1'),
    rankPosition: integer('rank_position').notNull(),
    score: doublePrecision('score').notNull(),
    requestId: varchar('request_id', { length: 64 }).notNull(),
    surfacedAt: timestamp('surfaced_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_rec_exposures_viewer_candidate').on(
      table.viewerUserId,
      table.candidateUserId,
      table.surfacedAt
    ),
    index('idx_rec_exposures_viewer_surfaced').on(table.viewerUserId, table.surfacedAt),
    index('idx_rec_exposures_request').on(table.requestId),
    index('idx_rec_exposures_candidate').on(table.candidateUserId),
  ]
);

export type RecommendationExposureRow = typeof recommendationExposures.$inferSelect;
export type NewRecommendationExposureRow = typeof recommendationExposures.$inferInsert;

/**
 * Recommendation Model Versions (Model Registry) (Gate 13)
 * Registry of available recommendation models, ranking weights, and rollout status.
 */
export const recommendationModelVersions = pgTable(
  'recommendation_model_versions',
  {
    id: uuid('id').primaryKey(),
    version: varchar('version', { length: 32 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    mode: varchar('mode', { length: 32 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    weights: jsonb('weights').notNull(),
    config: jsonb('config').notNull(),
    rolloutPercentage: integer('rollout_percentage').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_rec_model_version_mode').on(table.version, table.mode),
    index('idx_rec_model_is_active').on(table.isActive),
  ]
);

export type RecommendationModelVersionRow = typeof recommendationModelVersions.$inferSelect;
export type NewRecommendationModelVersionRow = typeof recommendationModelVersions.$inferInsert;

/**
 * Recommendation Experiment Assignments (Gate 13)
 * Tracks user assignment to recommendation experiments and model variants.
 */
export const recommendationExperimentAssignments = pgTable(
  'recommendation_experiment_assignments',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    experimentId: varchar('experiment_id', { length: 64 }).notNull(),
    variant: varchar('variant', { length: 32 }).notNull(),
    modelVersion: varchar('model_version', { length: 32 }).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_rec_exp_user_experiment').on(table.userId, table.experimentId),
    index('idx_rec_exp_experiment_variant').on(table.experimentId, table.variant),
  ]
);

export type RecommendationExperimentAssignmentRow =
  typeof recommendationExperimentAssignments.$inferSelect;
export type NewRecommendationExperimentAssignmentRow =
  typeof recommendationExperimentAssignments.$inferInsert;
