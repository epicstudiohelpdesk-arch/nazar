import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, and, sql, gt, or } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  users,
  moderationCases,
  reports,
  subscriptions,
  paymentTransactions,
  communities,
  events,
  posts,
  outboxEvents,
  notificationDeliveryJobs,
  recommendationModelVersions,
  recommendationExposures,
  userRecommendationFeatures,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type {
  AdminDashboardMetricsDto,
  AdminCommunitySummaryDto,
  AdminEventSummaryDto,
  AdminNotificationJobDto,
  AdminOutboxJobDto,
  AdminRecommendationDiagnosticsDto,
} from '@platform/api-contracts';

@Injectable()
export class AdminOperationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    const db = this.databaseService.client;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Users metrics
    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [suspendedUsers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(or(eq(users.status, 'SUSPENDED'), eq(users.status, 'BANNED')));
    const [newUsers24h] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gt(users.createdAt, oneDayAgo));

    // Safety metrics
    const [openCases] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moderationCases)
      .where(or(eq(moderationCases.status, 'OPEN'), eq(moderationCases.status, 'UNDER_REVIEW')));
    const [criticalCases] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moderationCases)
      .where(
        and(
          or(eq(moderationCases.status, 'OPEN'), eq(moderationCases.status, 'UNDER_REVIEW')),
          or(eq(moderationCases.priority, 'HIGH'), eq(moderationCases.priority, 'URGENT'))
        )
      );
    const [pendingReports] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(or(eq(reports.status, 'OPEN'), eq(reports.status, 'UNDER_REVIEW')));
    const [reports24h] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(gt(reports.createdAt, oneDayAgo));

    // Billing metrics
    const [activeSubs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'ACTIVE'));
    const [revenueRes] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentTransactions.amountMinor}), 0)::bigint` })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'SUCCEEDED'));

    // Social metrics
    const [totalComm] = await db.select({ count: sql<number>`count(*)::int` }).from(communities);
    const [totalEvt] = await db.select({ count: sql<number>`count(*)::int` }).from(events);
    const [totalPst] = await db.select({ count: sql<number>`count(*)::int` }).from(posts);

    // System jobs
    const [pendingOutbox] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(eq(outboxEvents.status, 'PENDING'));
    const [failedNotifications] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationDeliveryJobs)
      .where(eq(notificationDeliveryJobs.status, 'FAILED'));

    return {
      users: {
        totalCount: Number(totalUsers?.count || 0),
        activeTodayCount: Number(totalUsers?.count || 0),
        suspendedCount: Number(suspendedUsers?.count || 0),
        newLast24hCount: Number(newUsers24h?.count || 0),
      },
      safety: {
        openCasesCount: Number(openCases?.count || 0),
        criticalCasesCount: Number(criticalCases?.count || 0),
        pendingReportsCount: Number(pendingReports?.count || 0),
        totalReports24h: Number(reports24h?.count || 0),
      },
      billing: {
        activeSubscriptionsCount: Number(activeSubs?.count || 0),
        revenueCentsTotal: Number(revenueRes?.total || 0),
      },
      social: {
        totalCommunitiesCount: Number(totalComm?.count || 0),
        totalEventsCount: Number(totalEvt?.count || 0),
        totalPostsCount: Number(totalPst?.count || 0),
      },
      system: {
        status: Number(failedNotifications?.count || 0) > 100 ? 'DEGRADED' : 'HEALTHY',
        pendingOutboxCount: Number(pendingOutbox?.count || 0),
        failedNotificationJobsCount: Number(failedNotifications?.count || 0),
      },
    };
  }

  async getCommunities(): Promise<AdminCommunitySummaryDto[]> {
    const rows = await this.databaseService.client
      .select()
      .from(communities)
      .orderBy(desc(communities.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      privacy: r.privacy,
      memberCount: r.memberCount,
      creatorId: r.creatorId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getEvents(): Promise<AdminEventSummaryDto[]> {
    const rows = await this.databaseService.client
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      type: r.type,
      capacity: r.capacity,
      attendeeCount: r.attendeeCount,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      communityId: r.communityId,
      organizerId: r.organizerId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getOutboxJobs(): Promise<AdminOutboxJobDto[]> {
    const rows = await this.databaseService.client
      .select()
      .from(outboxEvents)
      .orderBy(desc(outboxEvents.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      aggregateType: r.aggregateType,
      aggregateId: r.aggregateId,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getNotificationJobs(): Promise<AdminNotificationJobDto[]> {
    const rows = await this.databaseService.client
      .select()
      .from(notificationDeliveryJobs)
      .orderBy(desc(notificationDeliveryJobs.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      notificationId: r.notificationId,
      provider: r.provider,
      status: r.status,
      attemptCount: r.attemptCount,
      lastAttemptAt: r.lastAttemptAt ? r.lastAttemptAt.toISOString() : null,
      lastErrorMessage: r.lastErrorMessage,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getRecommendationDiagnostics(): Promise<AdminRecommendationDiagnosticsDto> {
    const db = this.databaseService.client;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const models = await db
      .select()
      .from(recommendationModelVersions)
      .where(eq(recommendationModelVersions.isActive, true));

    const [exposures24h] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recommendationExposures)
      .where(gt(recommendationExposures.surfacedAt, oneDayAgo));

    const [featuresCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRecommendationFeatures);

    return {
      activeModelVersions: models.map((m) => ({
        id: m.id,
        version: m.version,
        mode: m.mode,
        rolloutPercentage: m.rolloutPercentage,
      })),
      exposuresLast24hCount: Number(exposures24h?.count || 0),
      featuresCoverageCount: Number(featuresCount?.count || 0),
    };
  }
}
