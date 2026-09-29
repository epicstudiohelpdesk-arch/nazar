import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, and, or, ilike, sql, lt, isNull } from 'drizzle-orm';
import crypto from 'node:crypto';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  users,
  profiles,
  profileMedia,
  profilePrompts,
  profilePromptDefinitions,
  profileInterests,
  interests,
  userIdentities,
  userRestrictions,
  sessions,
  userBlocks,
  reports,
  moderationCases,
  subscriptions,
  entitlements,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../../auth/repositories/session.repository.js';
import { AdminAuditService } from './admin-audit.service.js';
import type { AuthenticatedAdminPrincipal } from '../decorators/current-admin.decorator.js';
import type {
  AdminUserSearchQuery,
  AdminUserSummaryDto,
  AdminUserDetailDto,
  AdminSuspendUserRequest,
  AdminRestoreUserRequest,
  AdminRevokeSessionsRequest,
  AdminActionResponse,
} from '@platform/api-contracts';

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepo: ISessionRepository,
    @Inject(AdminAuditService)
    private readonly adminAuditService: AdminAuditService
  ) {}

  async searchUsers(
    query: AdminUserSearchQuery
  ): Promise<{ items: AdminUserSummaryDto[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = query.limit || 20;
    const conditions = [];

    if (query.status) {
      conditions.push(eq(users.status, query.status));
    }

    if (query.cursor) {
      try {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          conditions.push(lt(users.createdAt, cursorDate));
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const db = this.databaseService.client;

    const baseQuery = db
      .select({
        id: users.id,
        status: users.status,
        createdAt: users.createdAt,
        displayName: profiles.displayName,
        dateOfBirth: profiles.dateOfBirth,
        gender: profiles.gender,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId));

    if (query.query) {
      const q = `%${query.query.trim()}%`;
      conditions.push(
        or(ilike(profiles.displayName, q), sql`CAST(${users.id} AS text) ILIKE ${q}`)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await baseQuery
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

    // Fetch reports counts and identities for the batch
    const userIds = data.map((d) => d.id);
    const reportsCountMap = new Map<string, number>();
    const identityMap = new Map<string, { phone: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const reportRows = await db
        .select({
          targetUserId: reports.targetUserId,
          count: sql<number>`count(*)::int`,
        })
        .from(reports)
        .where(sql`${reports.targetUserId} IN ${userIds}`)
        .groupBy(reports.targetUserId);

      for (const r of reportRows) {
        if (r.targetUserId) {
          reportsCountMap.set(r.targetUserId, Number(r.count));
        }
      }

      const idRows = await db
        .select({
          userId: userIdentities.userId,
          provider: userIdentities.provider,
          providerSubject: userIdentities.providerSubject,
          email: userIdentities.email,
        })
        .from(userIdentities)
        .where(sql`${userIdentities.userId} IN ${userIds}`);

      for (const row of idRows) {
        const cur = identityMap.get(row.userId) || { phone: null, email: null };
        if (row.provider === 'PHONE') cur.phone = row.providerSubject;
        if (row.provider === 'EMAIL') cur.email = row.providerSubject;
        if (row.email && !cur.email) cur.email = row.email;
        identityMap.set(row.userId, cur);
      }
    }

    const items: AdminUserSummaryDto[] = data.map((row) => {
      const ids = identityMap.get(row.id) || { phone: null, email: null };
      let age: number | null = null;
      if (row.dateOfBirth) {
        const diffMs = Date.now() - new Date(row.dateOfBirth).getTime();
        age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      }

      return {
        id: row.id,
        phoneNumber: ids.phone,
        email: ids.email,
        status: row.status,
        displayName: row.displayName || null,
        gender: row.gender || null,
        birthDate: row.dateOfBirth ? row.dateOfBirth.toString() : null,
        age,
        isVerified: false,
        reportsCount: reportsCountMap.get(row.id) || 0,
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: null,
      };
    });

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getUserDetail(userId: string): Promise<AdminUserDetailDto> {
    const db = this.databaseService.client;

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Identities
    const idRows = await db.select().from(userIdentities).where(eq(userIdentities.userId, userId));
    let phone: string | null = null;
    let email: string | null = null;
    for (const id of idRows) {
      if (id.provider === 'PHONE') phone = id.providerSubject;
      if (id.provider === 'EMAIL') email = id.providerSubject;
      if (id.email && !email) email = id.email;
    }

    // Profile details
    const profileRows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const profile = profileRows[0] || null;

    let profileDto: AdminUserDetailDto['profile'] = null;
    if (profile) {
      const mediaRows = await db
        .select()
        .from(profileMedia)
        .where(eq(profileMedia.profileId, profile.id))
        .orderBy(profileMedia.position);

      const promptRows = await db
        .select({
          id: profilePrompts.id,
          prompt: profilePromptDefinitions.prompt,
          answer: profilePrompts.answer,
        })
        .from(profilePrompts)
        .innerJoin(
          profilePromptDefinitions,
          eq(profilePrompts.promptDefinitionId, profilePromptDefinitions.id)
        )
        .where(eq(profilePrompts.profileId, profile.id))
        .orderBy(profilePrompts.position);

      const interestRows = await db
        .select({
          name: interests.name,
        })
        .from(profileInterests)
        .innerJoin(interests, eq(profileInterests.interestId, interests.id))
        .where(eq(profileInterests.profileId, profile.id));

      const isComplete = Boolean(
        profile.completionStatus &&
        typeof profile.completionStatus === 'object' &&
        'isComplete' in profile.completionStatus &&
        (profile.completionStatus as { isComplete: boolean }).isComplete
      );

      profileDto = {
        displayName: profile.displayName,
        bio: profile.bio,
        birthDate: profile.dateOfBirth ? profile.dateOfBirth.toString() : null,
        gender: profile.gender,
        isVisible: profile.visibility === 'ACTIVE',
        isComplete,
        media: mediaRows.map((m) => ({
          id: m.id,
          url: m.objectKey,
          type: m.mediaType,
          isPrimary: m.isPrimary,
        })),
        prompts: promptRows.map((p) => ({
          id: p.id,
          prompt: p.prompt || '',
          answer: p.answer,
        })),
        interests: interestRows.map((i) => i.name),
      };
    }

    // Restrictions
    const restrictionRows = await db
      .select()
      .from(userRestrictions)
      .where(eq(userRestrictions.userId, userId))
      .orderBy(desc(userRestrictions.createdAt))
      .limit(20);

    const restrictionsDto = restrictionRows.map((r) => ({
      id: r.id,
      restrictionType: r.restrictionType,
      reason: r.reasonCode,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      isActive: !r.revokedAt && (!r.expiresAt || r.expiresAt > new Date()),
      createdAt: r.createdAt.toISOString(),
    }));

    // Recent Sessions
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(10);

    const sessionsDto = sessionRows.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt ? s.lastActiveAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
    }));

    // Safety stats
    const blocksReceived = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userBlocks)
      .where(eq(userBlocks.blockedUserId, userId));

    const blocksInitiated = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userBlocks)
      .where(eq(userBlocks.blockerUserId, userId));

    const reportsReceived = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.targetUserId, userId));

    const reportsInitiated = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.reporterUserId, userId));

    const openModCases = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moderationCases)
      .where(
        and(
          eq(moderationCases.subjectUserId, userId),
          or(eq(moderationCases.status, 'OPEN'), eq(moderationCases.status, 'UNDER_REVIEW'))
        )
      );

    // Subscriptions & Entitlements
    const subRows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'ACTIVE')));

    const entRows = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, userId), eq(entitlements.status, 'ACTIVE')));

    return {
      id: user.id,
      phoneNumber: phone,
      email,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      profile: profileDto,
      restrictions: restrictionsDto,
      recentSessions: sessionsDto,
      safetyStats: {
        blocksReceivedCount: Number(blocksReceived[0]?.count || 0),
        blocksInitiatedCount: Number(blocksInitiated[0]?.count || 0),
        reportsReceivedCount: Number(reportsReceived[0]?.count || 0),
        reportsInitiatedCount: Number(reportsInitiated[0]?.count || 0),
        activeModerationCasesCount: Number(openModCases[0]?.count || 0),
      },
      billingSummary: {
        activeSubscriptionsCount: subRows.length,
        entitlements: entRows.map((e) => e.entitlementCode),
      },
    };
  }

  async suspendUser(
    userId: string,
    input: AdminSuspendUserRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminActionResponse> {
    const db = this.databaseService.client;
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const previousStatus = user.status;
    let expiresAt: Date | null = null;
    if (input.durationDays && input.durationDays > 0) {
      expiresAt = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000);
    }

    // 1. Update user status
    await db
      .update(users)
      .set({
        status: 'SUSPENDED',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 2. Add restriction record
    await db.insert(userRestrictions).values({
      id: crypto.randomUUID(),
      userId,
      restrictionType: 'FULL_ACCOUNT',
      reasonCode: 'ADMIN_SUSPENSION',
      startsAt: new Date(),
      expiresAt,
    });

    // 3. Revoke all active sessions
    await this.sessionRepo.revokeAllUserSessions(userId, 'ADMIN_SUSPENSION');

    // 4. Log immutable audit trail with mandatory reason
    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'USER_SUSPEND',
      resourceType: 'USER',
      resourceId: userId,
      reason: input.reason,
      previousState: { status: previousStatus },
      newState: { status: 'SUSPENDED', durationDays: input.durationDays || 'PERMANENT' },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      message: `User ${userId} successfully suspended.`,
      userId,
      action: 'USER_SUSPEND',
      auditLogId: audit.id,
    };
  }

  async restoreUser(
    userId: string,
    input: AdminRestoreUserRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminActionResponse> {
    const db = this.databaseService.client;
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const previousStatus = user.status;

    // 1. Update user status
    await db
      .update(users)
      .set({
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 2. Revoke active full-account restrictions
    await db
      .update(userRestrictions)
      .set({
        revokedAt: new Date(),
        revokedByUserId: actor.adminId,
      })
      .where(and(eq(userRestrictions.userId, userId), isNull(userRestrictions.revokedAt)));

    // 3. Log audit trail
    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'USER_RESTORE',
      resourceType: 'USER',
      resourceId: userId,
      reason: input.reason,
      previousState: { status: previousStatus },
      newState: { status: 'ACTIVE' },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      message: `User ${userId} successfully restored to active status.`,
      userId,
      action: 'USER_RESTORE',
      auditLogId: audit.id,
    };
  }

  async revokeSessions(
    userId: string,
    input: AdminRevokeSessionsRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminActionResponse> {
    const revokedCount = await this.sessionRepo.revokeAllUserSessions(userId, 'ADMIN_FORCE_LOGOUT');

    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'USER_SESSIONS_REVOKE',
      resourceType: 'USER',
      resourceId: userId,
      reason: input.reason,
      metadata: { revokedCount },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      message: `Successfully revoked ${revokedCount} active session(s) for user ${userId}.`,
      userId,
      action: 'USER_SESSIONS_REVOKE',
      auditLogId: audit.id,
    };
  }
}
