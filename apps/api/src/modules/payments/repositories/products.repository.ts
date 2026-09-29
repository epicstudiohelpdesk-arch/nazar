import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import {
  products,
  productProviderMappings,
  productEntitlements,
  type ProductRow,
  type ProductProviderMappingRow,
} from '../../../infrastructure/database/drizzle/schema/products.js';
import type { IProductsRepository } from './products.repository.interface.js';
import type { EntitlementCode } from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class ProductsRepository implements IProductsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async findActiveProducts(tx?: DrizzleDatabase): Promise<readonly ProductRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(products)
      .where(eq(products.status, 'ACTIVE'))
      .orderBy(products.basePriceMinor);
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<ProductRow | null> {
    const client = this.getClient(tx);
    const [row] = await client.select().from(products).where(eq(products.id, id)).limit(1);
    return row || null;
  }

  async findByCode(code: string, tx?: DrizzleDatabase): Promise<ProductRow | null> {
    const client = this.getClient(tx);
    const [row] = await client.select().from(products).where(eq(products.code, code)).limit(1);
    return row || null;
  }

  async findByProviderProduct(
    provider: string,
    providerProductId: string,
    environment: string = 'PRODUCTION',
    tx?: DrizzleDatabase
  ): Promise<{ product: ProductRow; mapping: ProductProviderMappingRow } | null> {
    const client = this.getClient(tx);

    const rows = await client
      .select({
        product: products,
        mapping: productProviderMappings,
      })
      .from(productProviderMappings)
      .innerJoin(products, eq(productProviderMappings.productId, products.id))
      .where(
        and(
          eq(productProviderMappings.provider, provider),
          eq(productProviderMappings.providerProductId, providerProductId),
          eq(productProviderMappings.environment, environment)
        )
      )
      .limit(1);

    return rows[0] || null;
  }

  async getGrantedEntitlements(productId: string, tx?: DrizzleDatabase): Promise<readonly EntitlementCode[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select({ code: productEntitlements.entitlementCode })
      .from(productEntitlements)
      .where(eq(productEntitlements.productId, productId));

    return rows.map((r) => r.code as EntitlementCode);
  }

  async getProviderMappings(productId: string, tx?: DrizzleDatabase): Promise<readonly ProductProviderMappingRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(productProviderMappings)
      .where(eq(productProviderMappings.productId, productId));
  }

  async seedDefaultCatalog(tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);

    const catalog = [
      {
        code: 'PREMIUM_MONTHLY',
        name: 'Nazar Premium Monthly',
        description: 'Unlimited likes, see who liked you, advanced discovery filters, and unlimited rewinds',
        productType: 'SUBSCRIPTION',
        durationDays: 30,
        basePriceMinor: 19900, // ₹199.00
        baseCurrency: 'INR',
        entitlements: ['PREMIUM', 'SEE_LIKES', 'UNLIMITED_LIKES', 'ADVANCED_DISCOVERY', 'UNLIMITED_REWINDS'],
        mappings: [
          { provider: 'APPLE_APP_STORE', providerProductId: 'com.nazar.premium.monthly' },
          { provider: 'GOOGLE_PLAY', providerProductId: 'nazar_premium_monthly' },
          { provider: 'MOCK', providerProductId: 'mock_premium_monthly' },
        ],
      },
      {
        code: 'PREMIUM_ANNUAL',
        name: 'Nazar Premium Annual',
        description: 'Best value: All premium features + 1 free profile boost per month',
        productType: 'SUBSCRIPTION',
        durationDays: 365,
        basePriceMinor: 149900, // ₹1,499.00
        baseCurrency: 'INR',
        entitlements: ['PREMIUM', 'SEE_LIKES', 'UNLIMITED_LIKES', 'ADVANCED_DISCOVERY', 'PROFILE_BOOST', 'UNLIMITED_REWINDS'],
        mappings: [
          { provider: 'APPLE_APP_STORE', providerProductId: 'com.nazar.premium.annual' },
          { provider: 'GOOGLE_PLAY', providerProductId: 'nazar_premium_annual' },
          { provider: 'MOCK', providerProductId: 'mock_premium_annual' },
        ],
      },
      {
        code: 'BOOST_ONE_TIME',
        name: 'Profile Boost (24h)',
        description: 'Supercharge your profile visibility to 10x more discovery candidates for 24 hours',
        productType: 'ONE_TIME',
        durationDays: 1,
        basePriceMinor: 4900, // ₹49.00
        baseCurrency: 'INR',
        entitlements: ['PROFILE_BOOST'],
        mappings: [
          { provider: 'APPLE_APP_STORE', providerProductId: 'com.nazar.boost.onetime' },
          { provider: 'GOOGLE_PLAY', providerProductId: 'nazar_boost_onetime' },
          { provider: 'MOCK', providerProductId: 'mock_boost_onetime' },
        ],
      },
    ];

    for (const item of catalog) {
      let [existing] = await client.select().from(products).where(eq(products.code, item.code)).limit(1);

      if (!existing) {
        const prodId = generateUuidV7();
        [existing] = await client
          .insert(products)
          .values({
            id: prodId,
            code: item.code,
            name: item.name,
            description: item.description,
            productType: item.productType,
            status: 'ACTIVE',
            durationDays: item.durationDays,
            basePriceMinor: item.basePriceMinor,
            baseCurrency: item.baseCurrency,
          })
          .returning();
      }

      // Seed entitlements
      for (const entCode of item.entitlements) {
        await client
          .insert(productEntitlements)
          .values({
            id: generateUuidV7(),
            productId: existing!.id,
            entitlementCode: entCode,
          })
          .onConflictDoNothing({
            target: [productEntitlements.productId, productEntitlements.entitlementCode],
          });
      }

      // Seed provider mappings
      for (const mapping of item.mappings) {
        await client
          .insert(productProviderMappings)
          .values({
            id: generateUuidV7(),
            productId: existing!.id,
            provider: mapping.provider,
            providerProductId: mapping.providerProductId,
            environment: 'PRODUCTION',
          })
          .onConflictDoNothing({
            target: [
              productProviderMappings.provider,
              productProviderMappings.providerProductId,
              productProviderMappings.environment,
            ],
          });
      }
    }
  }
}
