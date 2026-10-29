import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';
import type { PaymentProviderType } from '@platform/api-contracts';
import {
  type IPaymentProvider,
  APPLE_PAYMENT_PROVIDER_TOKEN,
  GOOGLE_PAYMENT_PROVIDER_TOKEN,
  MOCK_PAYMENT_PROVIDER_TOKEN,
} from './payment-provider.interface.js';
import { AppConfigService } from '../../../config/app-config.service.js';

@Injectable()
export class PaymentProviderFactory {
  constructor(
    @Inject(APPLE_PAYMENT_PROVIDER_TOKEN)
    private readonly appleProvider: IPaymentProvider,
    @Inject(GOOGLE_PAYMENT_PROVIDER_TOKEN)
    private readonly googleProvider: IPaymentProvider,
    @Inject(MOCK_PAYMENT_PROVIDER_TOKEN)
    private readonly mockProvider: IPaymentProvider,
    @Inject(AppConfigService)
    private readonly config: AppConfigService
  ) {}

  getProvider(providerType: PaymentProviderType): IPaymentProvider {
    // Gate 1A: the mock provider is only reachable via the server-controlled
    // BILLING_PROVIDER_MOCK environment flag (forbidden in staging/production
    // by environment validation). A client-supplied `provider` field can no
    // longer select it, and unknown provider types fail closed instead of
    // silently falling back to the mock provider.
    if (providerType === 'MOCK') {
      if (!this.config.billingProviderMock) {
        throw new HttpException(
          {
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message:
              'Mock billing provider is disabled in this environment. Purchase verification is unavailable.',
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      return this.mockProvider;
    }

    switch (providerType) {
      case 'APPLE_APP_STORE':
        return this.appleProvider;
      case 'GOOGLE_PLAY':
        return this.googleProvider;
      default:
        throw new HttpException(
          {
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message: `Unsupported payment provider: ${providerType}`,
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
    }
  }
}
