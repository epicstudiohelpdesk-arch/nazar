/**
 * Analytics Event Taxonomy & Envelope Contracts (Gate 15)
 */

export type AnalyticsPrivacyClass = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'RESTRICTED';

export type AnalyticsRetentionClass =
  'RAW_30D' | 'RAW_90D' | 'RAW_365D' | 'AGGREGATE_1Y' | 'PERMANENT';

export type AnalyticsProducer = 'client' | 'server';

export type AnalyticsPlatform = 'ios' | 'android' | 'web' | 'backend';

export interface AnalyticsEventDefinition {
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly producer: 'client' | 'server' | 'both';
  readonly ownerDomain: string;
  readonly privacyClass: AnalyticsPrivacyClass;
  readonly retentionClass: AnalyticsRetentionClass;
  readonly requiredProperties: readonly string[];
  readonly optionalProperties?: readonly string[];
  readonly sensitiveProperties?: readonly string[];
}

/**
 * Canonical Event Envelope
 */
export interface AnalyticsEventEnvelope<TProps = Record<string, unknown>> {
  readonly eventId: string; // UUIDv7
  readonly eventName: string;
  readonly eventVersion: number;
  readonly occurredAt: string; // ISO 8601
  readonly receivedAt: string; // ISO 8601
  readonly producer: AnalyticsProducer;
  readonly requestId?: string | null;
  readonly actorUserId?: string | null;
  readonly anonymousId?: string | null;
  readonly sessionId?: string | null;
  readonly deviceId?: string | null;
  readonly platform?: AnalyticsPlatform | null;
  readonly appVersion?: string | null;
  readonly locale?: string | null;
  readonly privacyClass: AnalyticsPrivacyClass;
  readonly properties: TProps;
  readonly context?: Record<string, unknown> | null;
}

/**
 * Client Ingestion Payload Item
 */
export interface AnalyticsClientEventItemDto {
  readonly eventId: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly anonymousId?: string;
  readonly deviceId?: string;
  readonly platform?: AnalyticsPlatform;
  readonly appVersion?: string;
  readonly locale?: string;
  readonly properties: Record<string, unknown>;
  readonly context?: Record<string, unknown>;
}

/**
 * Ingestion Batch Request DTO
 */
export interface IngestAnalyticsEventsDto {
  readonly events: AnalyticsClientEventItemDto[];
}

/**
 * Ingestion Result DTO
 */
export interface IngestAnalyticsEventsResultDto {
  readonly accepted: number;
  readonly duplicates: number;
  readonly quarantined: number;
  readonly rejected: number;
  readonly processedEventIds: string[];
}

/**
 * Event Quarantine Record DTO
 */
export interface AnalyticsQuarantineItemDto {
  readonly id: string;
  readonly eventId: string;
  readonly eventName?: string | null;
  readonly failureReason: string;
  readonly rawPayload: Record<string, unknown>;
  readonly source: string;
  readonly errorDetails?: string | null;
  readonly receivedAt: string;
}
