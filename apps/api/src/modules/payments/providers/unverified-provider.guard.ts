import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';
import type { AppConfigService } from '../../../config/app-config.service.js';

/**
 * Gate 1A: fail-closed guard for payment providers whose purchase and webhook
 * processing does not currently perform cryptographic verification:
 *
 *  - Apple: JWS payloads are decoded without signature/chain validation.
 *  - Google: purchase tokens are never validated against the Play Developer API.
 *
 * Until Gate 1C ships real server-side verification, these paths must not be
 * able to grant entitlements or mutate subscription state. The guard is
 * server-controlled via BILLING_ALLOW_UNVERIFIED_PROVIDERS, which environment
 * validation forbids enabling in staging/production.
 */
export function assertUnverifiedBillingProcessingAllowed(
  config: AppConfigService,
  providerDisplayName: string
): void {
  if (!config.billingAllowUnverifiedProviders) {
    throw new HttpException(
      {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: `${providerDisplayName} purchase and webhook processing is temporarily disabled pending server-side cryptographic verification (Gate 1C).`,
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
