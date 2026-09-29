import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import {
  ENTITLEMENTS_REPOSITORY_TOKEN,
  type IEntitlementsRepository,
} from '../repositories/entitlements.repository.interface.js';
import {
  ErrorCode,
  type EntitlementCode,
  type UserEntitlementDto,
  type EntitlementSourceType,
} from '@platform/api-contracts';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { EntitlementRow } from '../../../infrastructure/database/drizzle/schema/entitlements.js';

export interface GrantEntitlementInput {
  readonly userId: string;
  readonly entitlementCode: EntitlementCode;
  readonly sourceType: EntitlementSourceType;
  readonly sourceId?: string;
  readonly startsAt?: Date;
  readonly expiresAt?: Date | null;
}

@Injectable()
export class EntitlementService {
  constructor(
    @Inject(ENTITLEMENTS_REPOSITORY_TOKEN)
    private readonly entitlementsRepo: IEntitlementsRepository
  ) {}

  /**
   * Check whether a user has an active, valid entitlement at the current moment.
   * Server-authoritative: starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()) AND revoked_at IS NULL
   */
  async hasEntitlement(userId: string, code: EntitlementCode): Promise<boolean> {
    return this.entitlementsRepo.hasActiveEntitlement(userId, code, new Date());
  }

  /**
   * Enforce that a user possesses a specific entitlement.
   * Throws ForbiddenException with ENTITLEMENT_REQUIRED error code if absent or expired.
   */
  async requireEntitlement(userId: string, code: EntitlementCode): Promise<void> {
    const hasAccess = await this.hasEntitlement(userId, code);
    if (!hasAccess) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.ENTITLEMENT_REQUIRED,
        message: `This feature requires active ${code} entitlement`,
        requiredEntitlement: code,
        details: [
          {
            field: 'entitlement',
            message: `Active ${code} entitlement is required`,
            code,
          },
        ],
      });
    }
  }

  /**
   * Return the list of all effective, active entitlements for a user.
   */
  async getEffectiveEntitlements(userId: string): Promise<readonly UserEntitlementDto[]> {
    const rows = await this.entitlementsRepo.findActiveEntitlements(userId, new Date());
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Grant or extend an entitlement for a user.
   */
  async grantEntitlement(input: GrantEntitlementInput, tx?: DrizzleDatabase): Promise<EntitlementRow> {
    return this.entitlementsRepo.grantOrExtendEntitlement(
      {
        userId: input.userId,
        entitlementCode: input.entitlementCode,
        sourceType: input.sourceType,
        sourceId: input.sourceId || null,
        status: 'ACTIVE',
        startsAt: input.startsAt || new Date(),
        expiresAt: input.expiresAt ?? null,
        revokedAt: null,
      },
      tx
    );
  }

  /**
   * Revoke a specific entitlement by ID.
   */
  async revokeEntitlement(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    return this.entitlementsRepo.revokeEntitlement(id, new Date(), tx);
  }

  /**
   * Revoke all entitlements associated with a specific source (e.g. cancelled/refunded subscription).
   */
  async revokeEntitlementsBySource(
    sourceType: EntitlementSourceType,
    sourceId: string,
    tx?: DrizzleDatabase
  ): Promise<number> {
    return this.entitlementsRepo.revokeBySource(sourceType, sourceId, new Date(), tx);
  }

  private toDto(row: EntitlementRow): UserEntitlementDto {
    const now = new Date();
    const isActive =
      row.status === 'ACTIVE' &&
      row.startsAt <= now &&
      (!row.expiresAt || row.expiresAt > now) &&
      !row.revokedAt;

    return {
      code: row.entitlementCode as EntitlementCode,
      active: isActive,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      sourceType: row.sourceType as EntitlementSourceType,
    };
  }
}
