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
  billingWebhookEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

describe('Billing: Concurrency & Race Conditions (Gate 11)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    // Gate 1A: server-controlled billing flags (test-only opt-in; startup
    // validation forbids both in staging/production). Apple webhook payloads
    // in this suite are unverified, hence the explicit unverified-provider flag.
    process.env.BILLING_PROVIDER_MOCK = 'true';
    process.env.BILLING_ALLOW_UNVERIFIED_PROVIDERS = 'true';
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

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
      dateOfBirth: '1995-10-05',
      gender: 'WOMAN',
      city: 'Kolkata',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('handles 10 concurrent purchase verifications of the same transaction idempotently without duplicates', async () => {
    const user = await createActiveUser('billing_concurrent_user');
    const sharedTxId = `concurrent_tx_${generateUuidV7()}`;

    // Fire 10 simultaneous verification requests with the exact same transaction ID
    const promises = Array.from({ length: 10 }).map(() =>
      request(app.getHttpServer())
        .post('/v1/billing/purchases/verify')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          provider: 'MOCK',
          productId: 'PREMIUM_MONTHLY',
          transactionId: sharedTxId,
        })
    );

    const results = await Promise.all(promises);

    // All 10 requests should succeed with 200
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.subscription).toBeDefined();
    }

    // All 10 returned the exact same subscription ID
    const firstSubId = results[0]!.body.data.subscription.id;
    for (const res of results) {
      expect(res.body.data.subscription.id).toBe(firstSubId);
    }

    // Verify DB integrity: exactly ONE subscription was created
    const userSubs = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.userId));
    expect(userSubs.length).toBe(1);

    // Verify DB integrity: exactly ONE transaction was created
    const userTxs = await databaseService.client
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, user.userId));
    expect(userTxs.length).toBe(1);

    // Verify DB integrity: exactly one set of entitlements was created
    const userEnts = await databaseService.client
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, user.userId));
    const premiumEnts = userEnts.filter((e) => e.entitlementCode === 'PREMIUM');
    expect(premiumEnts.length).toBe(1);
  });

  it('handles 10 concurrent duplicate webhook arrivals with exactly one processing and 9 deduplicated', async () => {
    const origTxId = `apple_race_${generateUuidV7()}`;
    const signedDate = Date.now();

    const signedTxInfo = makeJWS({
      transactionId: `tx_race_${generateUuidV7()}`,
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

    // Fire 10 simultaneous webhook submissions with the exact same payload
    const promises = Array.from({ length: 10 }).map(() =>
      request(app.getHttpServer()).post('/v1/webhooks/apple').send({ signedPayload })
    );

    const results = await Promise.all(promises);

    // All 10 succeed with 200
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);
    }

    const nonDuplicates = results.filter((r) => r.body.data.duplicate === false);
    const duplicates = results.filter((r) => r.body.data.duplicate === true);

    // Exactly 1 was processed as the primary event, 9 were flagged as duplicates
    expect(nonDuplicates.length).toBe(1);
    expect(duplicates.length).toBe(9);

    // All return the same primary eventId
    const primaryEventId = nonDuplicates[0]!.body.data.eventId;
    for (const d of duplicates) {
      expect(d.body.data.eventId).toBe(primaryEventId);
    }

    // Verify DB has exactly ONE row in billing_webhook_events
    const events = await databaseService.client
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, primaryEventId));
    expect(events.length).toBe(1);
  });

  it('handles race condition between simultaneous purchase verification and renewal webhook', async () => {
    const user = await createActiveUser('billing_race_user');
    const sharedOrigTxId = `race_shared_${generateUuidV7()}`;

    const signedTxInfo = makeJWS({
      transactionId: `tx_wh_${generateUuidV7()}`,
      originalTransactionId: sharedOrigTxId,
      productId: 'com.nazar.premium.monthly',
      purchaseDate: new Date().toISOString(),
      expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const signedPayload = makeJWS({
      notificationType: 'DID_RENEW',
      signedDate: Date.now(),
      data: {
        signedTransactionInfo: signedTxInfo,
      },
    });

    // Run purchase verification and store webhook concurrently
    const [verifyRes, webhookRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/billing/purchases/verify')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          provider: 'MOCK',
          productId: 'PREMIUM_MONTHLY',
          transactionId: sharedOrigTxId,
        }),
      request(app.getHttpServer()).post('/v1/webhooks/apple').send({ signedPayload }),
    ]);

    expect(verifyRes.status).toBe(200);
    expect(webhookRes.status).toBe(200);

    // Subscription and entitlements are coherent
    const userSubs = await databaseService.client
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.userId));
    expect(userSubs.length).toBe(1);
    expect(userSubs[0].status).toBe('ACTIVE');

    const userEnts = await databaseService.client
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, user.userId));
    expect(userEnts.some((e) => e.entitlementCode === 'PREMIUM' && e.revokedAt === null)).toBe(
      true
    );
  });
});
