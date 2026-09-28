import { Injectable, Inject, Logger } from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import { AuthEventType, type AuthSecuritySeverity } from '@platform/api-contracts';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  securityEvents,
  auditLogs,
  type NewSecurityEventRow,
  type NewAuditLogRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async recordSecurityEvent(params: {
    eventType: AuthEventType | string;
    severity?: AuthSecuritySeverity;
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const sanitizedMetadata = params.metadata
        ? this.sanitizeMetadata(params.metadata)
        : undefined;

      const eventData: NewSecurityEventRow = {
        id: generateUuidV7(),
        eventType: params.eventType,
        severity: params.severity ?? 'INFO',
        userId: params.userId,
        sessionId: params.sessionId,
        deviceId: params.deviceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: sanitizedMetadata,
      };

      await this.databaseService.client.insert(securityEvents).values(eventData);

      if (params.severity === 'CRITICAL' || params.severity === 'HIGH') {
        this.logger.warn(
          `[SECURITY ALERT] ${params.eventType} (Severity: ${params.severity}) for user=${params.userId ?? 'anonymous'} session=${params.sessionId ?? 'none'}`
        );
      }
    } catch (err: unknown) {
      // Security telemetry must not break user flows, but must be logged
      this.logger.error(
        `Failed to record security event ${params.eventType}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async recordAuditLog(params: {
    action: string;
    actorUserId?: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const logData: NewAuditLogRow = {
        id: generateUuidV7(),
        actorUserId: params.actorUserId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata ? this.sanitizeMetadata(params.metadata) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      };

      await this.databaseService.client.insert(auditLogs).values(logData);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to record audit log ${params.action}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'token',
      'refreshtoken',
      'accesstoken',
      'otp',
      'code',
      'password',
      'secret',
      'authorization',
      'privatekey',
    ];

    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        clean[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        clean[key] = this.sanitizeMetadata(val as Record<string, unknown>);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }
}
