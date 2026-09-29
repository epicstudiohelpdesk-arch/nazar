import {
  pgTable,
  uuid,
  varchar,
  integer,
  doublePrecision,
  jsonb,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Analytics Events Table (Gate 15)
 * Master append-only store for product, behavioral, and engagement telemetry.
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey(),
    eventName: varchar('event_name', { length: 64 }).notNull(),
    eventVersion: integer('event_version').notNull().default(1),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    producer: varchar('producer', { length: 16 }).notNull(), // 'client' | 'server'
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    anonymousId: varchar('anonymous_id', { length: 64 }),
    sessionId: varchar('session_id', { length: 64 }),
    deviceId: varchar('device_id', { length: 64 }),
    platform: varchar('platform', { length: 16 }), // 'ios' | 'android' | 'web' | 'backend'
    appVersion: varchar('app_version', { length: 32 }),
    locale: varchar('locale', { length: 16 }),
    requestId: varchar('request_id', { length: 64 }),
    privacyClass: varchar('privacy_class', { length: 16 }).notNull().default('INTERNAL'),
    properties: jsonb('properties').notNull(),
    context: jsonb('context'),
    ingestionStatus: varchar('ingestion_status', { length: 16 }).notNull().default('ACCEPTED'),
  },
  (table) => [
    index('idx_analytics_events_occurred_at').on(table.occurredAt),
    index('idx_analytics_events_name_occurred').on(table.eventName, table.occurredAt),
    index('idx_analytics_events_actor_occurred').on(table.actorUserId, table.occurredAt),
    index('idx_analytics_events_anonymous').on(table.anonymousId),
  ]
);

export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEventRow = typeof analyticsEvents.$inferInsert;

/**
 * Analytics Event Quarantine Table (Gate 15)
 * Safely captures malformed, unversioned, schema-violating, or suspicious events.
 */
export const analyticsEventQuarantine = pgTable(
  'analytics_event_quarantine',
  {
    id: uuid('id').primaryKey(),
    eventId: varchar('event_id', { length: 64 }).notNull(),
    eventName: varchar('event_name', { length: 64 }),
    failureReason: varchar('failure_reason', { length: 128 }).notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    source: varchar('source', { length: 32 }).notNull(),
    errorDetails: text('error_details'),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_analytics_quarantine_received').on(table.receivedAt),
    index('idx_analytics_quarantine_reason').on(table.failureReason),
  ]
);

export type AnalyticsEventQuarantineRow = typeof analyticsEventQuarantine.$inferSelect;
export type NewAnalyticsEventQuarantineRow = typeof analyticsEventQuarantine.$inferInsert;

/**
 * Analytics Daily Metrics Table (Gate 15)
 * Precomputed dimensional daily aggregate time series for rapid dashboard and reporting queries.
 */
export const analyticsDailyMetrics = pgTable(
  'analytics_daily_metrics',
  {
    id: uuid('id').primaryKey(),
    metricDate: varchar('metric_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
    metricName: varchar('metric_name', { length: 64 }).notNull(),
    dimension: varchar('dimension', { length: 64 }).notNull().default('total'),
    dimensionValue: varchar('dimension_value', { length: 64 }).notNull().default('all'),
    value: doublePrecision('value').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_analytics_daily_metric_unique').on(
      table.metricDate,
      table.metricName,
      table.dimension,
      table.dimensionValue
    ),
    index('idx_analytics_daily_metric_date').on(table.metricDate),
  ]
);

export type AnalyticsDailyMetricRow = typeof analyticsDailyMetrics.$inferSelect;
export type NewAnalyticsDailyMetricRow = typeof analyticsDailyMetrics.$inferInsert;

/**
 * Analytics Funnel Definitions Table (Gate 15)
 * Defines structured conversion funnels consisting of sequential canonical events.
 */
export const analyticsFunnelDefinitions = pgTable('analytics_funnel_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  version: integer('version').notNull().default(1),
  steps: jsonb('steps').notNull(), // Array of event names
  windowSeconds: integer('window_seconds').notNull().default(86400),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AnalyticsFunnelDefinitionRow = typeof analyticsFunnelDefinitions.$inferSelect;
export type NewAnalyticsFunnelDefinitionRow = typeof analyticsFunnelDefinitions.$inferInsert;

/**
 * Analytics Cohort Definitions Table (Gate 15)
 * Defines cohorts based on activation events, timeframes, and behavioral attributes.
 */
export const analyticsCohortDefinitions = pgTable('analytics_cohort_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  version: integer('version').notNull().default(1),
  activationEvent: varchar('activation_event', { length: 64 }).notNull(),
  criteria: jsonb('criteria'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AnalyticsCohortDefinitionRow = typeof analyticsCohortDefinitions.$inferSelect;
export type NewAnalyticsCohortDefinitionRow = typeof analyticsCohortDefinitions.$inferInsert;

/**
 * Analytics Experiment Definitions Table (Gate 15)
 * Registry of A/B and multivariate experiments with traffic allocations and variants.
 */
export const analyticsExperimentDefinitions = pgTable('analytics_experiment_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  version: integer('version').notNull().default(1),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  variants: jsonb('variants').notNull(), // string[]
  trafficPercentage: integer('traffic_percentage').notNull().default(100),
  salt: varchar('salt', { length: 64 }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true, mode: 'date' }),
  endAt: timestamp('end_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AnalyticsExperimentDefinitionRow = typeof analyticsExperimentDefinitions.$inferSelect;
export type NewAnalyticsExperimentDefinitionRow =
  typeof analyticsExperimentDefinitions.$inferInsert;

/**
 * Analytics Experiment Assignments Table (Gate 15)
 * Records deterministic participant assignment to experiment variants.
 */
export const analyticsExperimentAssignments = pgTable(
  'analytics_experiment_assignments',
  {
    id: uuid('id').primaryKey(),
    experimentId: varchar('experiment_id', { length: 64 }).notNull(),
    subjectId: varchar('subject_id', { length: 128 }).notNull(),
    variant: varchar('variant', { length: 32 }).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_exp_assign_unique').on(table.experimentId, table.subjectId),
    index('idx_exp_assign_experiment').on(table.experimentId),
  ]
);

export type AnalyticsExperimentAssignmentRow = typeof analyticsExperimentAssignments.$inferSelect;
export type NewAnalyticsExperimentAssignmentRow =
  typeof analyticsExperimentAssignments.$inferInsert;

/**
 * Analytics Experiment Exposures Table (Gate 15)
 * Tracks variant impressions and exposures for conversion attribution.
 */
export const analyticsExperimentExposures = pgTable(
  'analytics_experiment_exposures',
  {
    id: uuid('id').primaryKey(),
    experimentId: varchar('experiment_id', { length: 64 }).notNull(),
    subjectId: varchar('subject_id', { length: 128 }).notNull(),
    variant: varchar('variant', { length: 32 }).notNull(),
    exposedAt: timestamp('exposed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    properties: jsonb('properties'),
  },
  (table) => [
    index('idx_exp_exposures_exp_variant').on(table.experimentId, table.variant, table.exposedAt),
    index('idx_exp_exposures_subject').on(table.subjectId),
  ]
);

export type AnalyticsExperimentExposureRow = typeof analyticsExperimentExposures.$inferSelect;
export type NewAnalyticsExperimentExposureRow = typeof analyticsExperimentExposures.$inferInsert;
