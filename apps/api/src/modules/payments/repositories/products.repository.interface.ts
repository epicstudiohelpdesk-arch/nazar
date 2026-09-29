import type {
  ProductRow,
  ProductProviderMappingRow,
} from '../../../infrastructure/database/drizzle/schema/products.js';
import type { EntitlementCode } from '@platform/api-contracts';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface IProductsRepository {
  findActiveProducts(tx?: DrizzleDatabase): Promise<readonly ProductRow[]>;
  findById(id: string, tx?: DrizzleDatabase): Promise<ProductRow | null>;
  findByCode(code: string, tx?: DrizzleDatabase): Promise<ProductRow | null>;
  findByProviderProduct(
    provider: string,
    providerProductId: string,
    environment?: string,
    tx?: DrizzleDatabase
  ): Promise<{ product: ProductRow; mapping: ProductProviderMappingRow } | null>;
  getGrantedEntitlements(
    productId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly EntitlementCode[]>;
  getProviderMappings(
    productId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly ProductProviderMappingRow[]>;
  seedDefaultCatalog(tx?: DrizzleDatabase): Promise<void>;
}

export const PRODUCTS_REPOSITORY_TOKEN = 'PRODUCTS_REPOSITORY_TOKEN';
