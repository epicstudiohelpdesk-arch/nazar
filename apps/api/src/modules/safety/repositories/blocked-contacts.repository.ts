import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  blockedContacts,
  type BlockedContactRow,
} from '../../../infrastructure/database/drizzle/schema/blocked-contacts.js';
import type { IBlockedContactsRepository } from './blocked-contacts.repository.interface.js';

@Injectable()
export class BlockedContactsRepository implements IBlockedContactsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async blockContacts(
    userId: string,
    contacts: readonly { phoneHash: string; label?: string | null }[],
    tx?: DrizzleDatabase
  ): Promise<{ addedCount: number; totalCount: number }> {
    const client = this.getClient(tx);
    let addedCount = 0;

    for (const c of contacts) {
      const inserted = await client
        .insert(blockedContacts)
        .values({
          id: generateUuidV7(),
          userId,
          phoneHash: c.phoneHash.toLowerCase(),
          label: c.label || null,
        })
        .onConflictDoNothing({
          target: [blockedContacts.userId, blockedContacts.phoneHash],
        })
        .returning({ id: blockedContacts.id });

      if (inserted.length > 0) {
        addedCount++;
      }
    }

    const totalRows = await client
      .select({ count: sql<number>`count(*)` })
      .from(blockedContacts)
      .where(eq(blockedContacts.userId, userId));

    const totalCount = Number(totalRows[0]?.count || 0);

    return { addedCount, totalCount };
  }

  async unblockContact(
    userId: string,
    phoneHash: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const deleted = await client
      .delete(blockedContacts)
      .where(
        and(
          eq(blockedContacts.userId, userId),
          eq(blockedContacts.phoneHash, phoneHash.toLowerCase())
        )
      )
      .returning({ id: blockedContacts.id });

    return deleted.length > 0;
  }

  async listBlockedContacts(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly BlockedContactRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(blockedContacts)
      .where(eq(blockedContacts.userId, userId))
      .orderBy(blockedContacts.createdAt);
  }

  async getAllBlockedContactUserIds(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly string[]> {
    const client = this.getClient(tx);

    // Bidirectional exclusion:
    // 1. Users whose phone number SHA-256 is in this user's blocked_contacts
    // 2. Users who blocked this user's phone number SHA-256
    const query = sql<{ userId: string }>`
      WITH viewer_phone AS (
        SELECT encode(digest(provider_subject, 'sha256'), 'hex') as phone_hash
        FROM user_identities
        WHERE user_id = ${userId} AND provider = 'PHONE'
        LIMIT 1
      )
      -- 1. Contacts blocked by the viewer
      SELECT DISTINCT ui.user_id AS "userId"
      FROM user_identities ui
      JOIN blocked_contacts bc ON bc.phone_hash = encode(digest(ui.provider_subject, 'sha256'), 'hex')
      WHERE bc.user_id = ${userId}
        AND ui.provider = 'PHONE'
      
      UNION
      
      -- 2. Other users who blocked the viewer's phone number
      SELECT DISTINCT bc2.user_id AS "userId"
      FROM blocked_contacts bc2
      JOIN viewer_phone vp ON vp.phone_hash = bc2.phone_hash
    `;

    const res = await client.execute(query);
    const rows = (res.rows || res) as unknown as { userId: string }[];
    return rows.map((r) => r.userId);
  }
}
