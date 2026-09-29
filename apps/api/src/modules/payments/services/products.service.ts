import { Injectable, Inject, type OnModuleInit, NotFoundException } from '@nestjs/common';
import {
  PRODUCTS_REPOSITORY_TOKEN,
  type IProductsRepository,
} from '../repositories/products.repository.interface.js';
import {
  ErrorCode,
  type ProductResponseDto,
  type ProductListResponseDto,
  type ProductType,
} from '@platform/api-contracts';
import type { ProductRow } from '../../../infrastructure/database/drizzle/schema/products.js';

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @Inject(PRODUCTS_REPOSITORY_TOKEN)
    private readonly productsRepo: IProductsRepository
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed default catalog
    await this.productsRepo.seedDefaultCatalog();
  }

  async getActiveProducts(): Promise<ProductListResponseDto> {
    const rows = await this.productsRepo.findActiveProducts();
    const dtos: ProductResponseDto[] = [];

    for (const row of rows) {
      dtos.push(await this.toDto(row));
    }

    return { products: dtos };
  }

  async getProductByCode(code: string): Promise<ProductResponseDto> {
    const row = await this.productsRepo.findByCode(code);
    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.PRODUCT_NOT_FOUND,
        message: `Product ${code} not found`,
      });
    }

    return this.toDto(row);
  }

  async getProductByIdOrCode(idOrCode: string): Promise<ProductResponseDto> {
    let row = await this.productsRepo.findById(idOrCode);
    if (!row) {
      row = await this.productsRepo.findByCode(idOrCode);
    }
    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.PRODUCT_NOT_FOUND,
        message: `Product ${idOrCode} not found`,
      });
    }

    return this.toDto(row);
  }

  private async toDto(row: ProductRow): Promise<ProductResponseDto> {
    const grantedEntitlements = await this.productsRepo.getGrantedEntitlements(row.id);
    const mappings = await this.productsRepo.getProviderMappings(row.id);

    const providerProductIds: Record<string, string> = {};
    for (const m of mappings) {
      providerProductIds[m.provider] = m.providerProductId;
    }

    const formattedPrice =
      row.baseCurrency === 'INR'
        ? `₹${(row.basePriceMinor / 100).toFixed(0)}`
        : `${(row.basePriceMinor / 100).toFixed(2)} ${row.baseCurrency}`;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      productType: row.productType as ProductType,
      durationDays: row.durationDays,
      basePriceMinor: row.basePriceMinor,
      baseCurrency: row.baseCurrency,
      formattedPrice,
      providerProductIds,
      grantedEntitlements,
    };
  }
}
