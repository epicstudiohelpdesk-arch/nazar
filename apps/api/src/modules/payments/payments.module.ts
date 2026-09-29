import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AppConfigModule } from '../../config/app-config.module.js';

// Repositories
import { PRODUCTS_REPOSITORY_TOKEN } from './repositories/products.repository.interface.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { SUBSCRIPTIONS_REPOSITORY_TOKEN } from './repositories/subscriptions.repository.interface.js';
import { SubscriptionsRepository } from './repositories/subscriptions.repository.js';
import { PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN } from './repositories/payment-transactions.repository.interface.js';
import { PaymentTransactionsRepository } from './repositories/payment-transactions.repository.js';
import { ENTITLEMENTS_REPOSITORY_TOKEN } from './repositories/entitlements.repository.interface.js';
import { EntitlementsRepository } from './repositories/entitlements.repository.js';
import { BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN } from './repositories/billing-webhook-events.repository.interface.js';
import { BillingWebhookEventsRepository } from './repositories/billing-webhook-events.repository.js';

// Providers
import {
  APPLE_PAYMENT_PROVIDER_TOKEN,
  GOOGLE_PAYMENT_PROVIDER_TOKEN,
  MOCK_PAYMENT_PROVIDER_TOKEN,
} from './providers/payment-provider.interface.js';
import { ApplePaymentProvider } from './providers/apple-payment.provider.js';
import { GooglePaymentProvider } from './providers/google-payment.provider.js';
import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { PaymentProviderFactory } from './providers/payment-provider.factory.js';

// Services
import { EntitlementService } from './services/entitlement.service.js';
import { PurchasesService } from './services/purchases.service.js';
import { SubscriptionsService } from './services/subscriptions.service.js';
import { BillingWebhookService } from './services/billing-webhook.service.js';
import { BillingReconciliationService } from './services/billing-reconciliation.service.js';
import { ProductsService } from './services/products.service.js';

// Workers
import { BillingWebhookConsumer } from './workers/billing-webhook-consumer.js';
import { EntitlementExpirationWorker } from './workers/entitlement-expiration-worker.js';

// Controllers
import { BillingController } from './controllers/billing.controller.js';
import { WebhooksController } from './controllers/webhooks.controller.js';

@Module({
  imports: [InfrastructureModule, AppConfigModule],
  controllers: [BillingController, WebhooksController],
  providers: [
    // Repositories
    {
      provide: PRODUCTS_REPOSITORY_TOKEN,
      useClass: ProductsRepository,
    },
    {
      provide: SUBSCRIPTIONS_REPOSITORY_TOKEN,
      useClass: SubscriptionsRepository,
    },
    {
      provide: PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN,
      useClass: PaymentTransactionsRepository,
    },
    {
      provide: ENTITLEMENTS_REPOSITORY_TOKEN,
      useClass: EntitlementsRepository,
    },
    {
      provide: BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN,
      useClass: BillingWebhookEventsRepository,
    },
    // Payment Providers
    {
      provide: APPLE_PAYMENT_PROVIDER_TOKEN,
      useClass: ApplePaymentProvider,
    },
    {
      provide: GOOGLE_PAYMENT_PROVIDER_TOKEN,
      useClass: GooglePaymentProvider,
    },
    {
      provide: MOCK_PAYMENT_PROVIDER_TOKEN,
      useClass: MockPaymentProvider,
    },
    PaymentProviderFactory,
    // Services
    EntitlementService,
    PurchasesService,
    SubscriptionsService,
    BillingWebhookService,
    BillingReconciliationService,
    ProductsService,
    // Workers
    BillingWebhookConsumer,
    EntitlementExpirationWorker,
  ],
  exports: [
    EntitlementService,
    PurchasesService,
    SubscriptionsService,
    ProductsService,
    BillingWebhookService,
    BillingWebhookConsumer,
    EntitlementExpirationWorker,
    PaymentProviderFactory,
    PRODUCTS_REPOSITORY_TOKEN,
    SUBSCRIPTIONS_REPOSITORY_TOKEN,
    PAYMENT_TRANSACTIONS_REPOSITORY_TOKEN,
    ENTITLEMENTS_REPOSITORY_TOKEN,
    BILLING_WEBHOOK_EVENTS_REPOSITORY_TOKEN,
    APPLE_PAYMENT_PROVIDER_TOKEN,
    GOOGLE_PAYMENT_PROVIDER_TOKEN,
    MOCK_PAYMENT_PROVIDER_TOKEN,
  ],
})
export class PaymentsModule {}
