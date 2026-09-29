import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  adminSessions,
  type AdminSessionRow,
  type NewAdminSessionRow,
} from '../../../infrastructure/database/drizzle/schema/admin.js';

@Injectable()
export class AdminSessionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async createSession(data: NewAdminSessionRow): Promise<AdminSessionRow> {
    const [row] = await this.databaseService.client.insert(adminSessions).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<AdminSessionRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async findByTokenHash(tokenHash: string): Promise<AdminSessionRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.tokenHash, tokenHash))
      .limit(1);

    return rows[0] || null;
  }

  async revokeSession(id: string, reason = 'LOGOUT'): Promise<void> {
    await this.databaseService.client
      .update(adminSessions)
      .set({
        revokedAt: new Date(),
        revocationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(adminSessions.id, id));
  }

  async revokeAllForAdmin(adminUserId: string, reason = 'REVOKE_ALL'): Promise<void> {
    await this.databaseService.client
      .update(adminSessions)
      .set({
        revokedAt: new Date(),
        revocationReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(adminSessions.adminUserId, adminUserId), isNull(adminSessions.revokedAt)));
  }

  async updateLastActive(id: string, timestamp: Date): Promise<void> {
    await this.databaseService.client
      .update(adminSessions)
      .set({
        lastActiveAt: timestamp,
        updatedAt: new Date(),
      })
      .where(eq(adminSessions.id, id));
  }

  async findActiveSessionsForAdmin(adminUserId: string): Promise<AdminSessionRow[]> {
    return this.databaseService.client
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.adminUserId, adminUserId),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, new Date())
        )
      );
  }
}
