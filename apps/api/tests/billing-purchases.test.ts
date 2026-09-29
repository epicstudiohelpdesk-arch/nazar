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
  subscriptions,
  paymentTransactions,
  entitlements,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

describe('Billing: Purchase Verification, Idempotency & Restoration (Gate 11)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
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
      dateOfBirth: '1996-08-20',
      gender: 'WOMAN',
      city: 'Delhi',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('verifies a valid purchase, creates subscription, transaction and grants entitlements', async () => {
    const user = await createActiveUser('billing_verify_user');
    const transactionId = `tx_test_${generateUuidV7()}`;

    const res = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId,
        environment: 'SANDBOX',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.subscription).toBeDefined();
    expect(res.body.data.subscription.status).toBe('ACTIVE');
    expect(res.body.data.subscription.provider).toBe('MOCK');
    expect(res.body.data.effectiveEntitlements.length).toBeGreaterThan(0);
    expect(res.body.data.effectiveEntitlements.some((e: any) => e.code === 'PREMIUM')).toBe(true);

    // Verify DB state
    const userSubs = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.userId));
    expect(userSubs.length).toBe(1);
    expect(userSubs[0].status).toBe('ACTIVE');
    expect(userSubs[0].providerOriginalTransactionId).toBe(transactionId);

    const userTxs = await databaseService.client
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, user.userId));
    expect(userTxs.length).toBe(1);
    expect(userTxs[0].status).toBe('SUCCEEDED');
    expect(userTxs[0].providerTransactionId).toBe(transactionId);

    const userEnts = await databaseService.client
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, user.userId));
    expect(userEnts.length).toBeGreaterThanOrEqual(1);
    expect(userEnts.some((e) => e.entitlementCode === 'PREMIUM' && e.revokedAt === null)).toBe(
      true
    );
  });

  it('idempotently returns existing subscription and transaction on replay by the same user', async () => {
    const user = await createActiveUser('billing_idempotent_user');
    const transactionId = `tx_idempotent_${generateUuidV7()}`;

    // First attempt
    const res1 = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId,
      });

    expect(res1.status).toBe(200);
    const subId1 = res1.body.data.subscription.id;

    // Second attempt with exact same payload
    const res2 = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId,
      });

    expect(res2.status).toBe(200);
    expect(res2.body.data.subscription.id).toBe(subId1);

    // Verify DB still only has 1 subscription and 1 transaction
    const userSubs = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.userId));
    expect(userSubs.length).toBe(1);

    const userTxs = await databaseService.client
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, user.userId));
    expect(userTxs.length).toBe(1);
  });

  it('prevents cross-account theft (IDOR): rejects purchase verification if transaction already claimed by another user', async () => {
    const victim = await createActiveUser('billing_victim_user');
    const attacker = await createActiveUser('billing_attacker_user');
    const sharedTxId = `tx_shared_${generateUuidV7()}`;

    // Victim claims the purchase first
    const victimRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${victim.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: sharedTxId,
      });

    expect(victimRes.status).toBe(200);
    expect(victimRes.body.data.verified).toBe(true);

    // Attacker attempts to claim the same transactionId
    const attackerRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${attacker.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: sharedTxId,
      });

    expect([403, 409]).toContain(attackerRes.status);
    expect(['PURCHASE_ALREADY_CLAIMED', 'PURCHASE_OWNERSHIP_MISMATCH']).toContain(
      attackerRes.body.error.code
    );

    // Attacker does NOT get any subscriptions or entitlements
    const attackerSubs = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, attacker.userId));
    expect(attackerSubs.length).toBe(0);

    const attackerEnts = await databaseService.client
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, attacker.userId));
    expect(attackerEnts.length).toBe(0);
  });

  it('restores subscriptions across devices for authenticated user', async () => {
    const user = await createActiveUser('billing_restore_user');
    const txId = `tx_restore_${generateUuidV7()}`;

    // Make an initial purchase
    await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: txId,
      });

    // Now call restore
    const restoreRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/restore')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
      });

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);
    expect(restoreRes.body.data.restoredCount).toBeGreaterThanOrEqual(1);
    expect(restoreRes.body.data.subscriptions.length).toBeGreaterThanOrEqual(1);
    expect(restoreRes.body.data.effectiveEntitlements.some((e: any) => e.code === 'PREMIUM')).toBe(
      true
    );
  });
});
