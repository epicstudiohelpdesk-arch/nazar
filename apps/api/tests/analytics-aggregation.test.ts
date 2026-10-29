import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { AnalyticsAggregationService } from '../src/modules/analytics/services/analytics-aggregation.service.js';
import { AnalyticsIngestionService } from '../src/modules/analytics/services/analytics-ingestion.service.js';
import { AdminAuthService } from '../src/modules/admin/services/admin-auth.service.js';
import { AdminUsersRepository } from '../src/modules/admin/repositories/admin-users.repository.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { users } from '../src/infrastructure/database/drizzle/schema/users.js';
import { generateUuidV7 } from '@platform/domain';
import crypto from 'node:crypto';

describe('Gate 15: Analytics Aggregation, Funnels, Retention & Admin API', () => {
  let app: INestApplication;
  let aggregationService: AnalyticsAggregationService;
  let ingestionService: AnalyticsIngestionService;
  let adminAuthService: AdminAuthService;
  let adminUsersRepo: AdminUsersRepository;

  let adminToken: string;
  const adminEmail = `analytics-admin-${Date.now()}@nazar.internal`;
  const adminPassword = 'AdminPassword123!';

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    aggregationService = app.get(AnalyticsAggregationService);
    ingestionService = app.get(AnalyticsIngestionService);
    adminAuthService = app.get(AdminAuthService);
    adminUsersRepo = app.get(AdminUsersRepository);

    // Bootstrap seed and create test platform admin
    await adminAuthService.ensureDefaultRolesAndPermissions();
    const adminId = crypto.randomUUID();
    const passwordHash = adminAuthService.hashPassword(adminPassword);

    await adminUsersRepo.createAdminUser({
      id: adminId,
      email: adminEmail,
      passwordHash,
      firstName: 'Analytics',
      lastName: 'Admin',
      isActive: true,
      mfaEnabled: false,
    });

    await adminUsersRepo.assignRole(adminId, 'SUPER_ADMIN');

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = loginRes.body.data.accessToken;

    // Seed test events for aggregation
    const user1 = generateUuidV7();
    const user2 = generateUuidV7();

    const db = app.get(DatabaseService);
    await db.client.insert(users).values([
      { id: user1, status: 'ACTIVE' },
      { id: user2, status: 'ACTIVE' },
    ]);

    await ingestionService.recordServerEvent(
      'auth.signup.completed',
      { method: 'email' },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'profile.created',
      { gender: 'MAN', countryCode: 'IN' },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'profile.completed',
      { completionPercentage: 100 },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'discovery.feed.viewed',
      { candidateCount: 10 },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'interaction.like.created',
      { targetUserId: user2, source: 'DISCOVERY' },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'match.created',
      { matchId: generateUuidV7(), userAId: user1, userBId: user2 },
      { actorUserId: user1 }
    );
    await ingestionService.recordServerEvent(
      'message.sent',
      { conversationId: generateUuidV7(), lengthBucket: 'SHORT', hasAttachment: false },
      { actorUserId: user1 }
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('should compute daily metrics and store in analytics_daily_metrics', async () => {
    const today = new Date().toISOString().split('T')[0]!;
    const metricsCount = await aggregationService.computeDailyMetrics(today);
    expect(metricsCount).toBeGreaterThan(0);
  });

  it('should compute conversion funnel with step metrics and drop-off rates', async () => {
    const funnel = await aggregationService.computeFunnel('signup_funnel');
    expect(funnel).toBeDefined();
    expect(funnel.funnelId).toBe('signup_funnel');
    expect(funnel.steps.length).toBe(4);
    expect(funnel.steps[0]?.conversionRate).toBe(100);
  });

  it('should compute retention cohort matrix', async () => {
    const retention = await aggregationService.computeRetention({ limit: 10 });
    expect(retention).toBeDefined();
    expect(retention.activationEvent).toBe('auth.signup.completed');
    expect(Array.isArray(retention.cohorts)).toBe(true);
  });

  it('should allow authorized admin to query overview metrics via /v1/admin/analytics/overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeUsers).toBeDefined();
    expect(res.body.data.acquisition).toBeDefined();
    expect(res.body.data.engagement).toBeDefined();
  });

  it('should reject unauthenticated or non-admin requests to /v1/admin/analytics/*', async () => {
    const res = await request(app.getHttpServer()).get('/v1/admin/analytics/overview');

    expect(res.status).toBe(401);
  });

  it('should query pipeline health status via /v1/admin/analytics/health', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/analytics/health')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('HEALTHY');
    expect(res.body.data.totalEventsIngested).toBeGreaterThanOrEqual(0);
  });
});
