import { Injectable } from '@nestjs/common';
import {
  type AnalyticsEventDefinition,
  type AnalyticsClientEventItemDto,
} from '@platform/api-contracts';
import { CANONICAL_ANALYTICS_EVENTS } from '../constants/analytics.constants.js';
import { PROHIBITED_ANALYTICS_PROPERTY_NAMES } from '@platform/validation';

export interface GovernanceValidationResult {
  readonly isValid: boolean;
  readonly failureReason?: string;
  readonly errorDetails?: string;
  readonly definition?: AnalyticsEventDefinition;
}

@Injectable()
export class EventGovernanceService {
  /**
   * Evaluates an incoming event against the canonical governance policy.
   */
  validateEvent(
    event: AnalyticsClientEventItemDto,
    producer: 'client' | 'server'
  ): GovernanceValidationResult {
    const definition = CANONICAL_ANALYTICS_EVENTS[event.eventName];

    // 1. Unknown Event Name Check
    if (!definition) {
      return {
        isValid: false,
        failureReason: 'UNKNOWN_EVENT',
        errorDetails: `Event '${event.eventName}' is not registered in the canonical analytics taxonomy.`,
      };
    }

    // 2. Event Version Check
    if (event.eventVersion !== definition.version) {
      return {
        isValid: false,
        failureReason: 'INVALID_VERSION',
        errorDetails: `Event version ${event.eventVersion} does not match expected canonical version ${definition.version}.`,
      };
    }

    // 3. Producer Authority Check (Client cannot claim server-authoritative events)
    if (producer === 'client' && definition.producer === 'server') {
      return {
        isValid: false,
        failureReason: 'CLIENT_PRODUCER_FORBIDDEN',
        errorDetails: `Event '${event.eventName}' is server-authoritative and cannot be originated by a client.`,
      };
    }

    // 4. Timestamp Skew Validation
    const occurredDate = new Date(event.occurredAt);
    const now = Date.now();
    const futureLimit = now + 5 * 60 * 1000; // 5 minutes tolerance
    const pastLimit = now - 30 * 24 * 60 * 60 * 1000; // 30 days tolerance for offline queues

    if (isNaN(occurredDate.getTime())) {
      return {
        isValid: false,
        failureReason: 'MALFORMED_TIMESTAMP',
        errorDetails: `Timestamp '${event.occurredAt}' is not a valid ISO 8601 date.`,
      };
    }

    if (occurredDate.getTime() > futureLimit) {
      return {
        isValid: false,
        failureReason: 'INVALID_TIMESTAMP_SKEW_FUTURE',
        errorDetails: `Event occurredAt timestamp is more than 5 minutes in the future.`,
      };
    }

    if (occurredDate.getTime() < pastLimit) {
      return {
        isValid: false,
        failureReason: 'INVALID_TIMESTAMP_SKEW_PAST',
        errorDetails: `Event occurredAt timestamp is older than the 30-day offline threshold.`,
      };
    }

    // 5. Required Properties Check
    const properties = event.properties ?? {};
    for (const requiredKey of definition.requiredProperties) {
      if (properties[requiredKey] === undefined || properties[requiredKey] === null) {
        return {
          isValid: false,
          failureReason: 'MISSING_REQUIRED_PROPERTY',
          errorDetails: `Missing required property '${requiredKey}' for event '${event.eventName}'.`,
        };
      }
    }

    // 6. Prohibited / Sensitive Data Blacklist Check
    const keys = Object.keys(properties);
    for (const key of keys) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
      if (PROHIBITED_ANALYTICS_PROPERTY_NAMES.some((p) => normalized.includes(p))) {
        return {
          isValid: false,
          failureReason: 'SENSITIVE_DATA_DETECTED',
          errorDetails: `Property '${key}' violates privacy policy (contains prohibited sensitive identifier, credential, or raw content).`,
        };
      }
    }

    return {
      isValid: true,
      definition,
    };
  }
}
