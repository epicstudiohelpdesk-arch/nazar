import { Injectable, Inject } from '@nestjs/common';
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
    // If mock billing is forced or requested in non-prod
    if (this.config.billingProviderMock || providerType === 'MOCK') {
      return this.mockProvider;
    }

    switch (providerType) {
      case 'APPLE_APP_STORE':
        return this.appleProvider;
      case 'GOOGLE_PLAY':
        return this.googleProvider;
      default:
        return this.mockProvider;
    }
  }
}
