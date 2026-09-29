import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PRODUCTS_REPOSITORY_TOKEN,
  type IProductsRepository,
} from '../repositories/products.repository.interface.js';
import {
  SUBSCRIPTIONS_REPOSITORY_TOKEN,
  type ISubscriptionsRepository,
} from '../repositories/subscriptions.repository.interface.js';
import {
  PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN,
  type IPaymentTransactionsRepository,
} from '../repositories/payment-transactions.repository.interface.js';
import {
  ENTITLEMENTS_REPOSITORY_TOKEN,
  type IEntitlementsRepository,
} from '../repositories/entitlements.repository.interface.js';
import { PaymentProviderFactory } from '../providers/payment-provider.factory.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import {
  ErrorCode,
  type VerifyPurchaseRequestDto,
  type RestorePurchasesRequestDto,
  type PurchaseVerificationResultDto,
  type RestorePurchasesResultDto,
  type SubscriptionResponseDto,
  type PaymentTransactionResponseDto,
  type UserEntitlementDto,
  type EntitlementCode,
  type EntitlementSourceType,
} from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import type { SubscriptionRow } from '../../../infrastructure/database/drizzle/schema/subscriptions.js';
import type { PaymentTransactionRow } from '../../../infrastructure/database/drizzle/schema/payment-transactions.js';

@Injectable()
export class PurchasesService {
  constructor(
    @Inject(PRODUCTS_REPOSITORY_TOKEN)
    private readonly productsRepo: IProductsRepository,
    @Inject(SUBSCRIPTIONS_REPOSITORY_TOKEN)
    private readonly subscriptionsRepo: ISubscriptionsRepository,
    @Inject(PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN)
    private readonly transactionsRepo: IPaymentTransactionsRepository,
    @Inject(ENTITLEMENTS_REPOSITORY_TOKEN)
    private readonly entitlementsRepo: IEntitlementsRepository,
    @Inject(PaymentProviderFactory)
    private readonly providerFactory: PaymentProviderFactory,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Authoritatively verify an in-app purchase from Apple App Store or Google Play.
   * Atomically records payment transaction, creates/updates subscription, and grants entitlements.
   */
  async verifyPurchase(
    userId: string,
    dto: VerifyPurchaseRequestDto
  ): Promise<PurchaseVerificationResultDto> {
    this.logger.log(
      `[PurchasesService] Verifying purchase for user ${userId}, provider: ${dto.provider}, tx: ${dto.transactionId}`,
      'PurchasesService'
    );

    // 1. Check idempotency: Has this provider transaction already been recorded?
    const existingTx = await this.transactionsRepo.findByProviderTransactionId(
      dto.provider,
      dto.transactionId
    );

    if (existingTx) {
      if (existingTx.userId !== userId) {
        throw new ForbiddenException({
          statusCode: 403,
          code: ErrorCode.PURCHASE_OWNERSHIP_MISMATCH,
          message: 'This transaction was already registered to a different user account',
          details: [{ field: 'transactionId', message: 'Transaction ownership mismatch' }],
        });
      }

      // Idempotent return for same user
      const sub = existingTx.subscriptionId
        ? await this.subscriptionsRepo.findById(existingTx.subscriptionId)
        : null;
      const effectiveEntitlements = await this.getEffectiveEntitlementDtos(userId);
      const product = await this.productsRepo.findById(existingTx.productId);

      return {
        verified: true,
        subscription: sub ? this.toSubscriptionDto(sub, product?.code || 'UNKNOWN') : undefined,
        transaction: this.toTransactionDto(existingTx, product?.code || 'UNKNOWN'),
        effectiveEntitlements,
      };
    }

    // 2. Resolve internal product:
    // First try by provider product ID mapping, fallback to internal code
    let resolvedProduct = null;
    const mappingResult = await this.productsRepo.findByProviderProduct(
      dto.provider,
      dto.productId,
      dto.environment || 'PRODUCTION'
    );

    if (mappingResult) {
      resolvedProduct = mappingResult.product;
    } else {
      resolvedProduct = await this.productsRepo.findByCode(dto.productId);
    }

    if (!resolvedProduct || resolvedProduct.status !== 'ACTIVE') {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.PRODUCT_NOT_FOUND,
        message: `Product ${dto.productId} not found or inactive`,
      });
    }

    // 3. Verify against external store provider
    const provider = this.providerFactory.getProvider(dto.provider);
    const verifiedPurchase = await provider.verifyPurchase({
      userId,
      provider: dto.provider,
      productId: dto.productId,
      transactionId: dto.transactionId,
      purchaseToken: dto.purchaseToken,
      receiptData: dto.receiptData,
      environment: dto.environment,
    });

    if (verifiedPurchase.status !== 'SUCCEEDED') {
      throw new BadRequestException({
        statusCode: 400,
        code: ErrorCode.PURCHASE_VERIFICATION_FAILED,
        message: 'Provider reported purchase verification failure',
      });
    }

    // 4. Atomic PostgreSQL transaction: Update Subscriptions, Payment Transactions, Entitlements, and Outbox
    let result: {
      subscription: SubscriptionRow | null;
      transaction: PaymentTransactionRow;
    };

    try {
      result = await this.databaseService.client.transaction(async (tx) => {
        let subscriptionRow: SubscriptionRow | null = null;
        const now = new Date();

        if (resolvedProduct.productType === 'SUBSCRIPTION') {
          const periodStart = verifiedPurchase.purchaseDate || now;
          const periodEnd =
            verifiedPurchase.expiresDate ||
            new Date(
              periodStart.getTime() + (resolvedProduct.durationDays || 30) * 24 * 60 * 60 * 1000
            );

          subscriptionRow = await this.subscriptionsRepo.upsertSubscription(
            {
              userId,
              productId: resolvedProduct.id,
              provider: dto.provider,
              providerSubscriptionId:
                dto.purchaseToken || verifiedPurchase.providerOriginalTransactionId,
              providerOriginalTransactionId: verifiedPurchase.providerOriginalTransactionId,
              status: 'ACTIVE',
              startedAt: periodStart,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelledAt: null,
              expiresAt: periodEnd,
              autoRenewEnabled: verifiedPurchase.autoRenewStatus ?? true,
              gracePeriodUntil: null,
              metadata: verifiedPurchase.rawMetadata || {},
            },
            tx
          );
        }

        // Record transaction
        const transactionRow = await this.transactionsRepo.createTransaction(
          {
            userId,
            productId: resolvedProduct.id,
            subscriptionId: subscriptionRow?.id || null,
            provider: dto.provider,
            providerTransactionId: verifiedPurchase.providerTransactionId,
            providerOriginalTransactionId: verifiedPurchase.providerOriginalTransactionId,
            transactionType: verifiedPurchase.transactionType,
            status: 'SUCCEEDED',
            amountMinor: verifiedPurchase.amountMinor || resolvedProduct.basePriceMinor,
            currency: verifiedPurchase.currency || resolvedProduct.baseCurrency,
            providerCreatedAt: verifiedPurchase.purchaseDate,
            verifiedAt: now,
            providerMetadata: verifiedPurchase.rawMetadata || {},
          },
          tx
        );

        // Grant product entitlements
        const grantedCodes = await this.productsRepo.getGrantedEntitlements(resolvedProduct.id, tx);
        const entitlementExpiry =
          resolvedProduct.productType === 'SUBSCRIPTION'
            ? verifiedPurchase.expiresDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            : resolvedProduct.durationDays
              ? new Date(now.getTime() + resolvedProduct.durationDays * 24 * 60 * 60 * 1000)
              : null;

        for (const entCode of grantedCodes) {
          await this.entitlementsRepo.grantOrExtendEntitlement(
            {
              userId,
              entitlementCode: entCode,
              sourceType:
                resolvedProduct.productType === 'SUBSCRIPTION'
                  ? 'SUBSCRIPTION'
                  : 'ONE_TIME_PURCHASE',
              sourceId: subscriptionRow?.id || transactionRow.id,
              status: 'ACTIVE',
              startsAt: now,
              expiresAt: entitlementExpiry,
              revokedAt: null,
            },
            tx
          );
        }

        // Emit outbox events
        if (subscriptionRow) {
          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'subscription.created',
            aggregateType: 'SUBSCRIPTION',
            aggregateId: subscriptionRow.id,
            payload: {
              subscriptionId: subscriptionRow.id,
              userId,
              productCode: resolvedProduct.code,
              provider: dto.provider,
              expiresAt: subscriptionRow.expiresAt?.toISOString(),
            },
            status: 'PENDING',
          });
        }

        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'payment.succeeded',
          aggregateType: 'PAYMENT_TRANSACTION',
          aggregateId: transactionRow.id,
          payload: {
            transactionId: transactionRow.id,
            userId,
            amountMinor: transactionRow.amountMinor,
            currency: transactionRow.currency,
            productCode: resolvedProduct.code,
          },
          status: 'PENDING',
        });

        return {
          subscription: subscriptionRow,
          transaction: transactionRow,
        };
      });
    } catch (err: unknown) {
      const errObj = err as {
        code?: string;
        message?: string;
        cause?: { code?: string; message?: string };
      };
      const isUniqueViolation =
        errObj?.code === '23505' ||
        errObj?.cause?.code === '23505' ||
        errObj?.message?.includes('duplicate key') ||
        errObj?.message?.includes('unique constraint') ||
        errObj?.cause?.message?.includes('duplicate key') ||
        errObj?.cause?.message?.includes('unique constraint');

      if (isUniqueViolation) {
        const raceTx = await this.transactionsRepo.findByProviderTransactionId(
          dto.provider,
          dto.transactionId
        );
        if (raceTx) {
          if (raceTx.userId !== userId) {
            throw new ForbiddenException({
              statusCode: 403,
              code: ErrorCode.PURCHASE_OWNERSHIP_MISMATCH,
              message: 'This transaction was already registered to a different user account',
            });
          }
          const sub = raceTx.subscriptionId
            ? await this.subscriptionsRepo.findById(raceTx.subscriptionId)
            : null;
          const effectiveEntitlements = await this.getEffectiveEntitlementDtos(userId);
          const product = await this.productsRepo.findById(raceTx.productId);

          return {
            verified: true,
            subscription: sub ? this.toSubscriptionDto(sub, product?.code || 'UNKNOWN') : undefined,
            transaction: this.toTransactionDto(raceTx, product?.code || 'UNKNOWN'),
            effectiveEntitlements,
          };
        }
      }
      throw err;
    }

    const effectiveEntitlements = await this.getEffectiveEntitlementDtos(userId);

    return {
      verified: true,
      subscription: result.subscription
        ? this.toSubscriptionDto(result.subscription, resolvedProduct.code)
        : undefined,
      transaction: this.toTransactionDto(result.transaction, resolvedProduct.code),
      effectiveEntitlements,
    };
  }

  /**
   * Restore purchases across devices for the authenticated user.
   */
  async restorePurchases(
    userId: string,
    dto: RestorePurchasesRequestDto
  ): Promise<RestorePurchasesResultDto> {
    this.logger.log(
      `[PurchasesService] Restoring purchases for user ${userId}, provider: ${dto.provider}`,
      'PurchasesService'
    );

    const tokens = dto.purchaseTokens || (dto.receiptData ? [dto.receiptData] : []);
    const restoredSubscriptions: SubscriptionResponseDto[] = [];
    let restoredCount = 0;

    if (tokens.length === 0) {
      const existingSubs = await this.subscriptionsRepo.findByUserId(userId);
      for (const sub of existingSubs) {
        if (sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD') {
          const product = await this.productsRepo.findById(sub.productId);
          restoredSubscriptions.push(this.toSubscriptionDto(sub, product?.code || 'UNKNOWN'));
          restoredCount++;
        }
      }
    } else {
      for (const token of tokens) {
        try {
          const verifyRes = await this.verifyPurchase(userId, {
            provider: dto.provider,
            productId: 'PREMIUM_MONTHLY', // Default fallback; resolved by token
            transactionId: `restore_${token.slice(0, 16)}`,
            purchaseToken: token,
            receiptData: dto.receiptData,
            environment: dto.environment,
          });

          if (verifyRes.subscription) {
            restoredSubscriptions.push(verifyRes.subscription);
            restoredCount++;
          }
        } catch (err: unknown) {
          this.logger.warn(
            `[PurchasesService] Restore token verification skipped: ${err instanceof Error ? err.message : String(err)}`,
            'PurchasesService'
          );
        }
      }
    }

    const effectiveEntitlements = await this.getEffectiveEntitlementDtos(userId);

    return {
      restoredCount,
      subscriptions: restoredSubscriptions,
      effectiveEntitlements,
    };
  }

  private async getEffectiveEntitlementDtos(
    userId: string
  ): Promise<readonly UserEntitlementDto[]> {
    const rows = await this.entitlementsRepo.findActiveEntitlements(userId, new Date());
    const now = new Date();
    return rows.map((r) => ({
      code: r.entitlementCode as EntitlementCode,
      active:
        r.status === 'ACTIVE' &&
        r.startsAt <= now &&
        (!r.expiresAt || r.expiresAt > now) &&
        !r.revokedAt,
      startsAt: r.startsAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      sourceType: r.sourceType as EntitlementSourceType,
    }));
  }

  private toSubscriptionDto(row: SubscriptionRow, productCode: string): SubscriptionResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      productCode,
      provider: row.provider as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: row.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      startedAt: row.startedAt.toISOString(),
      currentPeriodStart: row.currentPeriodStart.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      autoRenewEnabled: row.autoRenewEnabled,
      gracePeriodUntil: row.gracePeriodUntil ? row.gracePeriodUntil.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toTransactionDto(
    row: PaymentTransactionRow,
    productCode: string
  ): PaymentTransactionResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      productCode,
      subscriptionId: row.subscriptionId,
      provider: row.provider as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      transactionType: row.transactionType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: row.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      amountMinor: row.amountMinor,
      currency: row.currency,
      providerCreatedAt: row.providerCreatedAt ? row.providerCreatedAt.toISOString() : null,
      verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
