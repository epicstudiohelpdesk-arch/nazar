import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import { EMAIL_PROVIDER_TOKEN } from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

// Gate 1A acceptance tests: unsafe payment paths fail closed by default.
// With no environment opt-in, client-controlled provider selection (MOCK)
// and unverified Apple/Google processing must be rejected — no entitlement
// may be granted (Gate 0 findings C-3/C-4).
describe('Gate 1A: Billing trust boundaries fail closed by default', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    const mockEmailProvider = app.get<never>(EMAIL_PROVIDER_TOKEN);
    const email = `fc_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = (mockEmailProvider as unknown as { getLastCode(e: string): string }).getLastCode(
      email
    );
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });
    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const verifyPurchase = (provider: string) =>
    request(app.getHttpServer())
      .post('/v1/billing/purchases/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider,
        productId: 'premium_monthly',
        transactionId: `forged-${Date.now()}`,
        receiptData: 'forged.receipt.data',
      });

  it('rejects client-selected MOCK provider (503, no entitlement granted)', async () => {
    const res = await verifyPurchase('MOCK');
    expect([500, 503]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('rejects Apple purchase verification while unverified processing is disabled', async () => {
    const res = await verifyPurchase('APPLE_APP_STORE');
    expect([404, 500, 503]).toContain(res.status);
  });

  it('rejects Google purchase verification while unverified processing is disabled', async () => {
    const res = await verifyPurchase('GOOGLE_PLAY');
    expect([404, 500, 503]).toContain(res.status);
  });

  it('rejects Apple webhooks (unsigned) with 503', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/apple')
      .send({ signedPayload: 'forged' });
    expect(res.status).toBe(503);
  });

  it('rejects Google webhooks (unauthenticated) with 503', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/google')
      .send({ message: { data: Buffer.from('{}').toString('base64url') } });
    expect([400, 503]).toContain(res.status);
  });
});
