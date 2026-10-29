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
  billingWebhookEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';
import { BillingWebhookConsumer } from '../src/modules/payments/workers/billing-webhook-consumer.js';

describe('Billing: Provider Webhooks & Idempotency (Gate 11)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let webhookConsumer: BillingWebhookConsumer;

  beforeAll(async () => {
    // Gate 1A: webhook processing is fail-closed by default because these
    // payloads are NOT signature-verified (Gate 0 finding C-4; Gate 1C ships
    // verification). This suite explicitly opts in via environment flags —
    // the only sanctioned way — to keep exercising the legacy pipeline and
    // its idempotency/claiming logic behind the gate. Default-deny behavior
    // is asserted in gate-1a-fail-closed-trust-boundaries.
    process.env.BILLING_PROVIDER_MOCK = 'true';
    process.env.BILLING_ALLOW_UNVERIFIED_PROVIDERS = 'true';
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    webhookConsumer = app.get(BillingWebhookConsumer);
  });

  afterAll(async () => {
    await app.close();
  });

  // NOTE (Gate 1A): this helper forges a JWS with a fake signature. Under the
  // default configuration such payloads are REJECTED before parsing (no
  // signature verification exists; Gate 0 finding C-4 / Gate 1C scope). The
  // suite only reaches this code with BILLING_ALLOW_UNVERIFIED_PROVIDERS=true.
  function makeJWS(payload: object): string {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = Buffer.from('mock-sig').toString('base64url');
    return `${header}.${body}.${sig}`;
  }

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
      dateOfBirth: '1992-06-18',
      gender: 'MAN',
      city: 'Chennai',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('receives and processes Apple App Store Server Notification v2', async () => {
    const origTxId = `apple_orig_${generateUuidV7()}`;
    const signedDate = Date.now();

    const signedTxInfo = makeJWS({
      transactionId: `tx_apple_${generateUuidV7()}`,
      originalTransactionId: origTxId,
      productId: 'com.nazar.premium.monthly',
      purchaseDate: new Date().toISOString(),
      expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const signedPayload = makeJWS({
      notificationType: 'DID_RENEW',
      subtype: 'BILLING_RECOVERY',
      signedDate,
      data: {
        signedTransactionInfo: signedTxInfo,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.duplicate).toBe(false);
    expect(res.body.data.eventId).toBeDefined();

    // Verify stored in billing_webhook_events
    const [event] = await databaseService.client
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, res.body.data.eventId));

    expect(event).toBeDefined();
    expect(event.provider).toBe('APPLE_APP_STORE');
    expect(event.status).toBe('PROCESSED');
    expect(event.payloadHash).toBeDefined();
  });

  it('idempotently deduplicates duplicate Apple webhook delivery', async () => {
    const origTxId = `apple_dup_${generateUuidV7()}`;
    const signedDate = Date.now();

    const signedTxInfo = makeJWS({
      transactionId: `tx_dup_${generateUuidV7()}`,
      originalTransactionId: origTxId,
      productId: 'com.nazar.premium.monthly',
    });

    const signedPayload = makeJWS({
      notificationType: 'DID_RENEW',
      signedDate,
      data: {
        signedTransactionInfo: signedTxInfo,
      },
    });

    // First arrival
    const res1 = await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload });

    expect(res1.status).toBe(200);
    expect(res1.body.data.duplicate).toBe(false);

    // Duplicate arrival with exact same signedPayload
    const res2 = await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload });

    expect(res2.status).toBe(200);
    expect(res2.body.data.duplicate).toBe(true);
    expect(res2.body.data.eventId).toBe(res1.body.data.eventId);
  });

  it('receives and processes Google Play RTDN webhook', async () => {
    const purchaseToken = `google_token_${generateUuidV7()}`;
    const messageId = `msg_${generateUuidV7()}`;

    const rtdnPayload = {
      version: '1.0',
      packageName: 'com.nazar.app',
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: '1.0',
        notificationType: 2, // RENEWED
        purchaseToken,
        subscriptionId: 'nazar_premium_monthly',
      },
    };

    const data = Buffer.from(JSON.stringify(rtdnPayload)).toString('base64');

    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/google')
      .send({
        message: {
          data,
          messageId,
          publishTime: new Date().toISOString(),
        },
        subscription: 'projects/nazar/subscriptions/rtdn',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.duplicate).toBe(false);

    // Verify stored in billing_webhook_events
    const [event] = await databaseService.client
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, res.body.data.eventId));

    expect(event).toBeDefined();
    expect(event.provider).toBe('GOOGLE_PLAY');
    expect(event.status).toBe('PROCESSED');
  });

  it('rejects invalid or malformed webhook payload with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload: 'malformed_non_jwt_string' });

    expect(res.status).toBe(400);
  });

  it('handles out-of-order webhook delivery without regressing subscription state', async () => {
    const user = await createActiveUser('billing_ooo_user');
    const origTxId = `ooo_tx_${generateUuidV7()}`;

    // 1. Initial purchase creates subscription active until T+30 days
    await request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        provider: 'MOCK',
        productId: 'PREMIUM_MONTHLY',
        transactionId: origTxId,
      });

    const [sub] = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerOriginalTransactionId, origTxId));

    const futureEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Update subscription to already renewed state (e.g. valid for 60 days)
    await databaseService.client
      .update(subscriptions)
      .set({
        currentPeriodEnd: futureEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    // 2. An older webhook arrives (simulating delayed carrier delivery) with periodEnd = T+30 days
    const olderEventDate = new Date(Date.now() - 5000);
    const olderTxInfo = makeJWS({
      transactionId: `tx_old_${generateUuidV7()}`,
      originalTransactionId: origTxId,
      productId: 'com.nazar.premium.monthly',
      purchaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiresDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const olderSignedPayload = makeJWS({
      notificationType: 'DID_RENEW',
      signedDate: olderEventDate.getTime(),
      data: {
        signedTransactionInfo: olderTxInfo,
      },
    });

    await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload: olderSignedPayload });

    // Verify subscription currentPeriodEnd was NOT regressed backwards to T+20 days
    const [subAfter] = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id));

    expect(subAfter.currentPeriodEnd.getTime()).toBe(futureEnd.getTime());
  });

  it('allows BillingWebhookConsumer to claim pending events atomically', async () => {
    // Seed a pending webhook event directly in the DB with valid signedPayload
    const eventId = generateUuidV7();
    const providerEventId = `consumer_test_${generateUuidV7()}`;

    const signedTxInfo = makeJWS({
      transactionId: `tx_consumer_${generateUuidV7()}`,
      originalTransactionId: `orig_consumer_${generateUuidV7()}`,
      productId: 'com.nazar.premium.monthly',
    });

    const signedPayload = makeJWS({
      notificationType: 'DID_RENEW',
      signedDate: Date.now(),
      data: {
        signedTransactionInfo: signedTxInfo,
      },
    });

    await databaseService.client.insert(billingWebhookEvents).values({
      id: eventId,
      provider: 'APPLE_APP_STORE',
      providerEventId,
      eventType: 'RENEWAL',
      payloadHash: 'mock-hash-123',
      rawPayload: { signedPayload },
      status: 'PENDING',
      attemptCount: 0,
      receivedAt: new Date(),
    });

    // Claim via consumer
    const claimedCount = await webhookConsumer.processPendingWebhooks(10);
    expect(claimedCount).toBeGreaterThanOrEqual(1);

    // Verify status transitioned to PROCESSED
    const [claimed] = await databaseService.client
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, eventId));

    expect(claimed.status).toBe('PROCESSED');
  });
});
