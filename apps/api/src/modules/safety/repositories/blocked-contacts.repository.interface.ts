import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { BlockedContactRow } from '../../../infrastructure/database/drizzle/schema/blocked-contacts.js';

export interface IBlockedContactsRepository {
  blockContacts(
    userId: string,
    contacts: readonly { phoneHash: string; label?: string | null }[],
    tx?: DrizzleDatabase
  ): Promise<{ addedCount: number; totalCount: number }>;

  unblockContact(userId: string, phoneHash: string, tx?: DrizzleDatabase): Promise<boolean>;

  listBlockedContacts(userId: string, tx?: DrizzleDatabase): Promise<readonly BlockedContactRow[]>;

  getAllBlockedContactUserIds(userId: string, tx?: DrizzleDatabase): Promise<readonly string[]>;
}

export const BLOCKED_CONTACTS_REPOSITORY_TOKEN = Symbol('IBlockedContactsRepository');
