import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  userInteractions,
  type UserInteractionRow,
} from '../../../infrastructure/database/drizzle/schema/interactions.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  IInteractionsRepository,
  InteractionAttachmentOptions,
  InboundLikeRecord,
} from './interactions.repository.interface.js';

@Injectable()
export class InteractionsRepository implements IInteractionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async upsertInteraction(
    actorUserId: string,
    targetUserId: string,
    type: 'LIKE' | 'PASS',
    attachmentOptions?: InteractionAttachmentOptions,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const [row] = await client
      .insert(userInteractions)
      .values({
        id,
        actorUserId,
        targetUserId,
        type,
        targetAttachmentType: attachmentOptions?.targetAttachmentType || 'PROFILE',
        targetAttachmentId: attachmentOptions?.targetAttachmentId || null,
        comment: attachmentOptions?.comment || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userInteractions.actorUserId, userInteractions.targetUserId],
        set: {
          type,
          targetAttachmentType: attachmentOptions?.targetAttachmentType || 'PROFILE',
          targetAttachmentId: attachmentOptions?.targetAttachmentId || null,
          comment: attachmentOptions?.comment || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to upsert interaction record');
    }

    return row;
  }

  async findInteraction(
    actorUserId: string,
    targetUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.actorUserId, actorUserId),
          eq(userInteractions.targetUserId, targetUserId)
        )
      )
      .limit(1);

    return rows[0] || null;
  }

  async findRecentInteraction(
    actorUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.actorUserId, actorUserId))
      .orderBy(sql`${userInteractions.updatedAt} DESC`)
      .limit(1);

    return rows[0] || null;
  }

  async deleteInteraction(id: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .delete(userInteractions)
      .where(eq(userInteractions.id, id))
      .returning();

    return result.length > 0;
  }

  async findInteractionsByActor(
    actorUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly UserInteractionRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.actorUserId, actorUserId))
      .orderBy(sql`${userInteractions.createdAt} DESC`)
      .limit(limit);
  }

  async findInboundLikes(
    targetUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<{ items: readonly InboundLikeRecord[]; totalCount: number }> {
    const client = this.getClient(tx);

    const itemsQuery = sql<InboundLikeRecord>`
      SELECT
        ui.id,
        ui.actor_user_id AS "actorUserId",
        ui.target_attachment_type AS "targetAttachmentType",
        ui.target_attachment_id AS "targetAttachmentId",
        ui.comment,
        ui.created_at AS "createdAt",
        p.id AS "profileId",
        p.display_name AS "displayName",
        p.date_of_birth::text AS "dateOfBirth",
        p.city,
        p.occupation,
        p.is_verified AS "isVerified",
        pm.object_key AS "primaryPhotoKey"
      FROM user_interactions ui
      JOIN profiles p ON p.user_id = ui.actor_user_id
      LEFT JOIN profile_media pm ON pm.profile_id = p.id AND pm.is_primary = true AND pm.status = 'READY'
      WHERE ui.target_user_id = ${targetUserId}
        AND ui.type = 'LIKE'
        AND NOT EXISTS (
          SELECT 1 FROM user_interactions rev
          WHERE rev.actor_user_id = ${targetUserId}
            AND rev.target_user_id = ui.actor_user_id
        )
      ORDER BY ui.created_at DESC
      LIMIT ${limit}
    `;

    const countQuery = sql<{ count: number }>`
      SELECT count(*)::int AS count
      FROM user_interactions ui
      JOIN profiles p ON p.user_id = ui.actor_user_id
      WHERE ui.target_user_id = ${targetUserId}
        AND ui.type = 'LIKE'
        AND NOT EXISTS (
          SELECT 1 FROM user_interactions rev
          WHERE rev.actor_user_id = ${targetUserId}
            AND rev.target_user_id = ui.actor_user_id
        )
    `;

    const [itemsResult, countResult] = await Promise.all([
      client.execute(itemsQuery),
      client.execute(countQuery),
    ]);

    const items = (itemsResult.rows as unknown as InboundLikeRecord[]) || [];
    const countRow = countResult.rows[0] as { count?: number } | undefined;
    const totalCount = countRow?.count ? Number(countRow.count) : items.length;

    return { items, totalCount };
  }
}
