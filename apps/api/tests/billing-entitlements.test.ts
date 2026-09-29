import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  entitlements,
  subscriptions,
  products,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';
import { EntitlementService } from '../src/modules/payments/services/entitlement.service.js';
import { EntitlementExpirationWorker } from '../src/modules/payments/workers/entitlement-expiration-worker.js';

describe('Billing: Entitlements, Gating & Expiration (Gate 11)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let entitlementService: EntitlementService;
  let expirationWorker: EntitlementExpirationWorker;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    entitlementService = app.get(EntitlementService);
    expirationWorker = app.get(EntitlementExpirationWorker);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;

    await databaseService.client.insert(profiles).values({
      id: generateUuidV7(),
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1997-11-12',
      gender: 'NON_BINARY',
      city: 'Hyderabad',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('evaluates effective entitlements and returns hasPremium: false for free user', async () => {
    const freeUser = await createActiveUser('billing_free_user');

    const res = await request(app.getHttpServer())
      .get('/v1/billing/entitlements')
      .set('Authorization', `Bearer ${freeUser.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.entitlements.length).toBe(0);
    expect(res.body.data.hasPremium).toBe(false);

    const hasPrem = await entitlementService.hasEntitlement(freeUser.userId, 'PREMIUM');
    expect(hasPrem).toBe(false);
  });

  it('evaluates effective entitlements and returns hasPremium: true for subscribed user', async () => {
    const premiumUser = await createActiveUser('billing_paid_user');

    // Purchase premium
    await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${premiumUser.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: `tx_prem_${generateUuidV7()}`,
      });

    const res = await request(app.getHttpServer())
      .get('/v1/billing/entitlements')
      .set('Authorization', `Bearer ${premiumUser.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasPremium).toBe(true);
    expect(res.body.data.entitlements.length).toBeGreaterThanOrEqual(1);

    const hasPrem = await entitlementService.hasEntitlement(premiumUser.userId, 'PREMIUM');
    expect(hasPrem).toBe(true);

    // requireEntitlement does not throw for active entitlement
    await expect(
      entitlementService.requireEntitlement(premiumUser.userId, 'PREMIUM')
    ).resolves.not.toThrow();
  });

  it('enforces feature gating: throws ENTITLEMENT_REQUIRED when user lacks required entitlement', async () => {
    const user = await createActiveUser('billing_gate_user');

    await expect(
      entitlementService.requireEntitlement(user.userId, 'SEE_LIKES')
    ).rejects.toThrow();

    try {
      await entitlementService.requireEntitlement(user.userId, 'SEE_LIKES');
      expect.fail('Should have thrown ForbiddenException');
    } catch (err: any) {
      expect(err.response?.code).toBe('ENTITLEMENT_REQUIRED');
      expect(err.response?.requiredEntitlement).toBe('SEE_LIKES');
    }
  });

  it('evaluates time-aware status: treats expired and revoked entitlements as inactive', async () => {
    const user = await createActiveUser('billing_time_user');
    const now = Date.now();

    // 1. Future entitlement (starts tomorrow)
    const futureId = generateUuidV7();
    await databaseService.client.insert(entitlements).values({
      id: futureId,
      userId: user.userId,
      entitlementCode: 'PROFILE_BOOST',
      sourceType: 'ADMIN_GRANT',
      status: 'ACTIVE',
      startsAt: new Date(now + 86400000), // starts in 24h
      expiresAt: new Date(now + 172800000),
    });

    const hasFuture = await entitlementService.hasEntitlement(user.userId, 'PROFILE_BOOST');
    expect(hasFuture).toBe(false);

    // 2. Expired entitlement (expired 1 hour ago)
    const expiredId = generateUuidV7();
    await databaseService.client.insert(entitlements).values({
      id: expiredId,
      userId: user.userId,
      entitlementCode: 'UNLIMITED_LIKES',
      sourceType: 'ONE_TIME_PURCHASE',
      status: 'ACTIVE',
      startsAt: new Date(now - 7200000),
      expiresAt: new Date(now - 3600000),
    });

    const hasExpired = await entitlementService.hasEntitlement(user.userId, 'UNLIMITED_LIKES');
    expect(hasExpired).toBe(false);

    // 3. Revoked entitlement
    const revokedId = generateUuidV7();
    await databaseService.client.insert(entitlements).values({
      id: revokedId,
      userId: user.userId,
      entitlementCode: 'SEE_LIKES',
      sourceType: 'PROMOTION',
      status: 'ACTIVE',
      startsAt: new Date(now - 7200000),
      expiresAt: new Date(now + 7200000),
      revokedAt: new Date(now - 1000),
    });

    const hasRevoked = await entitlementService.hasEntitlement(user.userId, 'SEE_LIKES');
    expect(hasRevoked).toBe(false);
  });

  it('expiration worker sweeps expired entitlements and updates DB status to EXPIRED', async () => {
    const user = await createActiveUser('billing_worker_user');
    const past = new Date(Date.now() - 60000);

    // Insert an active entitlement that passed its expiration date
    const expiredEntId = generateUuidV7();
    await databaseService.client.insert(entitlements).values({
      id: expiredEntId,
      userId: user.userId,
      entitlementCode: 'UNLIMITED_REWINDS',
      sourceType: 'PROMOTION',
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 3600000),
      expiresAt: past,
    });

    // Run expiration worker
    const workerResult = await expirationWorker.processExpirations(new Date());
    expect(workerResult.expiredEntitlements).toBeGreaterThanOrEqual(1);

    // Verify DB status transitioned to EXPIRED
    const [row] = await databaseService.client
      .select()
      .from(entitlements)
      .where(eq(entitlements.id, expiredEntId));

    expect(row.status).toBe('EXPIRED');
  });
});
