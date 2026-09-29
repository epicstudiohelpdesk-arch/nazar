import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { profiles, products } from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

describe('Billing: Products Catalog (Gate 11)', () => {
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
      dateOfBirth: '1995-04-10',
      gender: 'MAN',
      city: 'Mumbai',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('lists active products with integer minor units, currencies, and entitlements', async () => {
    const user = await createActiveUser('billing_prod_user');

    const res = await request(app.getHttpServer())
      .get('/v1/billing/products')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(3);

    const monthly = res.body.data.products.find((p: any) => p.code === 'PREMIUM_MONTHLY');
    expect(monthly).toBeDefined();
    expect(monthly.productType).toBe('SUBSCRIPTION');
    expect(monthly.basePriceMinor).toBe(19900);
    expect(monthly.baseCurrency).toBe('INR');
    expect(monthly.durationDays).toBe(30);
    expect(monthly.grantedEntitlements).toContain('PREMIUM');
    expect(monthly.providerProductIds).toBeDefined();
    expect(monthly.providerProductIds.APPLE_APP_STORE).toBe('com.nazar.premium.monthly');
  });

  it('filters out inactive products from the listing', async () => {
    const user = await createActiveUser('billing_inactive_user');

    // Insert an inactive product
    const inactiveId = generateUuidV7();
    await databaseService.client.insert(products).values({
      id: inactiveId,
      code: `LEGACY_PLAN_${generateUuidV7().substring(0, 8)}`,
      name: 'Legacy Retired Plan',
      description: 'No longer for sale',
      productType: 'SUBSCRIPTION',
      status: 'INACTIVE',
      basePriceMinor: 999,
      baseCurrency: 'USD',
    });

    const res = await request(app.getHttpServer())
      .get('/v1/billing/products')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    const listedIds = res.body.data.products.map((p: any) => p.id);
    expect(listedIds).not.toContain(inactiveId);

    // Clean up
    await databaseService.client.delete(products).where(eq(products.id, inactiveId));
  });

  it('retrieves a single product by ID or code', async () => {
    const user = await createActiveUser('billing_single_prod');

    const listRes = await request(app.getHttpServer())
      .get('/v1/billing/products')
      .set('Authorization', `Bearer ${user.accessToken}`);

    const firstProduct = listRes.body.data.products[0];

    const getRes = await request(app.getHttpServer())
      .get(`/v1/billing/products/${firstProduct.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(firstProduct.id);
    expect(getRes.body.data.code).toBe(firstProduct.code);
  });

  it('returns 404 for non-existent product', async () => {
    const user = await createActiveUser('billing_prod_404');
    const fakeId = generateUuidV7();

    const res = await request(app.getHttpServer())
      .get(`/v1/billing/products/${fakeId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
