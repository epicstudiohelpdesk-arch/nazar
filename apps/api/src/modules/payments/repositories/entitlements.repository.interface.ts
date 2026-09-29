import type {
  EntitlementRow,
  NewEntitlementRow,
} from '../../../infrastructure/database/drizzle/schema/entitlements.js';
import type { EntitlementCode } from '@platform/api-contracts';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface IEntitlementsRepository {
  findActiveEntitlements(userId: string, asOf?: Date, tx?: DrizzleDatabase): Promise<readonly EntitlementRow[]>;
  hasActiveEntitlement(userId: string, code: EntitlementCode, asOf?: Date, tx?: DrizzleDatabase): Promise<boolean>;
  grantOrExtendEntitlement(
    data: Omit<NewEntitlementRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<EntitlementRow>;
  revokeEntitlement(id: string, revokedAt?: Date, tx?: DrizzleDatabase): Promise<boolean>;
  expireEntitlement(id: string, asOf?: Date, tx?: DrizzleDatabase): Promise<boolean>;
  revokeBySource(sourceType: string, sourceId: string, revokedAt?: Date, tx?: DrizzleDatabase): Promise<number>;
  findExpiredActiveEntitlements(asOf?: Date, tx?: DrizzleDatabase): Promise<readonly EntitlementRow[]>;
}

export const ENTITLEMENTS_REPOSITORY_TOKEN = 'ENTITLEMENTS_REPOSITORY_TOKEN';
