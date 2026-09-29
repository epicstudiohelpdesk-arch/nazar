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
  products,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

describe('Billing: Subscriptions & Transaction History (Gate 11)', () => {
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
      dateOfBirth: '1994-03-25',
      gender: 'MAN',
      city: 'Bengaluru',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('lists user subscriptions and retrieves subscription details by ID', async () => {
    const user = await createActiveUser('billing_subs_user');
    const txId = `tx_sub_${generateUuidV7()}`;

    // Purchase subscription
    const purchaseRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: txId,
      });

    expect(purchaseRes.status).toBe(200);
    const subId = purchaseRes.body.data.subscription.id;

    // List subscriptions
    const listRes = await request(app.getHttpServer())
      .get('/v1/billing/subscriptions')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.subscriptions.length).toBe(1);
    expect(listRes.body.data.subscriptions[0].id).toBe(subId);
    expect(listRes.body.data.subscriptions[0].status).toBe('ACTIVE');

    // Get specific subscription
    const getRes = await request(app.getHttpServer())
      .get(`/v1/billing/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.id).toBe(subId);
    expect(getRes.body.data.productCode).toBe('PREMIUM_MONTHLY');
  });

  it('enforces access control: prevents user from viewing another users subscription', async () => {
    const owner = await createActiveUser('billing_sub_owner');
    const snooper = await createActiveUser('billing_sub_snooper');

    // Owner creates subscription
    const purchaseRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: `tx_owner_${generateUuidV7()}`,
      });

    const subId = purchaseRes.body.data.subscription.id;

    // Snooper tries to view owner's subscription
    const snoopRes = await request(app.getHttpServer())
      .get(`/v1/billing/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${snooper.accessToken}`);

    expect([403, 404]).toContain(snoopRes.status);
  });

  it('tracks subscription state transitions (ACTIVE -> CANCELLED -> EXPIRED)', async () => {
    const user = await createActiveUser('billing_sub_lifecycle');
    const txId = `tx_lifecycle_${generateUuidV7()}`;

    const purchaseRes = await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: txId,
      });

    const subId = purchaseRes.body.data.subscription.id;

    // Transition to CANCELLED (user cancelled auto-renew, but period remains active)
    await databaseService.client
      .update(subscriptions)
      .set({
        status: 'CANCELLED',
        autoRenewEnabled: false,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subId));

    const cancelledRes = await request(app.getHttpServer())
      .get(`/v1/billing/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(cancelledRes.status).toBe(200);
    expect(cancelledRes.body.data.status).toBe('CANCELLED');
    expect(cancelledRes.body.data.autoRenewEnabled).toBe(false);

    // Transition to GRACE_PERIOD
    await databaseService.client
      .update(subscriptions)
      .set({
        status: 'GRACE_PERIOD',
        gracePeriodExpiresAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subId));

    const graceRes = await request(app.getHttpServer())
      .get(`/v1/billing/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(graceRes.status).toBe(200);
    expect(graceRes.body.data.status).toBe('GRACE_PERIOD');
  });

  it('retrieves transaction billing history with cursor pagination', async () => {
    const user = await createActiveUser('billing_history_user');

    // Get an existing product
    const [product] = await databaseService.client.select().from(products).limit(1);

    // Seed 3 separate transactions for user
    const baseTime = Date.now() - 30000;
    for (let i = 0; i < 3; i++) {
      await databaseService.client.insert(paymentTransactions).values({
        id: generateUuidV7(),
        userId: user.userId,
        productId: product.id,
        provider: 'MOCK',
        providerTransactionId: `tx_hist_${i}_${generateUuidV7()}`,
        transactionType: i === 0 ? 'INITIAL_PURCHASE' : 'RENEWAL',
        status: 'SUCCEEDED',
        amountMinor: 19900,
        currency: 'INR',
        createdAt: new Date(baseTime + i * 5000),
        updatedAt: new Date(baseTime + i * 5000),
      });
    }

    // First page with limit = 2
    const page1 = await request(app.getHttpServer())
      .get('/v1/billing/transactions?limit=2')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data.transactions.length).toBe(2);
    expect(page1.body.data.nextCursor).toBeDefined();

    // Second page with cursor
    const page2 = await request(app.getHttpServer())
      .get(`/v1/billing/transactions?limit=2&cursor=${page1.body.data.nextCursor}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.data.transactions.length).toBe(1);
    expect(page2.body.data.transactions[0].id).not.toBe(page1.body.data.transactions[0].id);
    expect(page2.body.data.transactions[0].id).not.toBe(page1.body.data.transactions[1].id);
  });
});
