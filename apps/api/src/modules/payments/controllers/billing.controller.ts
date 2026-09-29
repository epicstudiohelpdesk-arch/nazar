import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  type ProductListResponseDto,
  type ProductResponseDto,
  type VerifyPurchaseRequestDto,
  type RestorePurchasesRequestDto,
  type PurchaseVerificationResultDto,
  type RestorePurchasesResultDto,
  type EntitlementsListResponseDto,
  type SubscriptionListResponseDto,
  type SubscriptionResponseDto,
  type PaymentTransactionListResponseDto,
} from '@platform/api-contracts';
import {
  verifyPurchaseSchema,
  restorePurchasesSchema,
  listTransactionsQuerySchema,
} from '@platform/validation';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ProductsService } from '../services/products.service.js';
import { PurchasesService } from '../services/purchases.service.js';
import { SubscriptionsService } from '../services/subscriptions.service.js';
import { EntitlementService } from '../services/entitlement.service.js';

@ApiTags('Billing, Subscriptions & Entitlements')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/billing')
export class BillingController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
    @Inject(PurchasesService)
    private readonly purchasesService: PurchasesService,
    @Inject(SubscriptionsService)
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService
  ) {}

  @Public()
  @Get('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available products and subscription plans' })
  @SwaggerResponse({ status: 200, description: 'Catalog of active products' })
  async listProducts(): Promise<{ success: true; data: ProductListResponseDto }> {
    const data = await this.productsService.getActiveProducts();
    return { success: true, data };
  }

  @Public()
  @Get('products/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get details of a specific product by ID or code' })
  @SwaggerResponse({ status: 200, description: 'Product details' })
  async getProduct(
    @Param('id') id: string
  ): Promise<{ success: true; data: ProductResponseDto }> {
    const data = await this.productsService.getProductByIdOrCode(id);
    return { success: true, data };
  }

  @Post('purchases/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify native in-app purchase and grant authoritative entitlements' })
  @SwaggerResponse({ status: 200, description: 'Purchase verified successfully' })
  async verifyPurchase(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(verifyPurchaseSchema)) body: VerifyPurchaseRequestDto
  ): Promise<{ success: true; data: PurchaseVerificationResultDto }> {
    const data = await this.purchasesService.verifyPurchase(user.userId, body);
    return { success: true, data };
  }

  @Post('purchases/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore purchases across devices for authenticated user' })
  @SwaggerResponse({ status: 200, description: 'Restored purchases result' })
  async restorePurchases(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(restorePurchasesSchema)) body: RestorePurchasesRequestDto
  ): Promise<{ success: true; data: RestorePurchasesResultDto }> {
    const data = await this.purchasesService.restorePurchases(user.userId, body);
    return { success: true, data };
  }

  @Get('entitlements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get authenticated user active entitlements' })
  @SwaggerResponse({ status: 200, description: 'Effective entitlements list' })
  async getEntitlements(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: EntitlementsListResponseDto }> {
    const entitlements = await this.entitlementService.getEffectiveEntitlements(user.userId);
    const hasPremium = entitlements.some((e) => e.code === 'PREMIUM' && e.active);
    return {
      success: true,
      data: {
        entitlements,
        hasPremium,
      },
    };
  }

  @Get('subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List subscriptions for authenticated user' })
  @SwaggerResponse({ status: 200, description: 'User subscriptions' })
  async listSubscriptions(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<{ success: true; data: SubscriptionListResponseDto }> {
    const subscriptions = await this.subscriptionsService.getUserSubscriptions(user.userId);
    return {
      success: true,
      data: { subscriptions },
    };
  }

  @Get('subscriptions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get details of a specific subscription' })
  @SwaggerResponse({ status: 200, description: 'Subscription details' })
  async getSubscription(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string
  ): Promise<{ success: true; data: SubscriptionResponseDto }> {
    const data = await this.subscriptionsService.getSubscriptionById(user.userId, id);
    return { success: true, data };
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transaction billing history with cursor pagination' })
  @SwaggerResponse({ status: 200, description: 'User transactions' })
  async listTransactions(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new AppValidationPipe(listTransactionsQuerySchema)) query: { limit: number; cursor?: string }
  ): Promise<{ success: true; data: PaymentTransactionListResponseDto }> {
    const data = await this.subscriptionsService.getUserTransactions(user.userId, query.limit, query.cursor);
    return { success: true, data };
  }
}
