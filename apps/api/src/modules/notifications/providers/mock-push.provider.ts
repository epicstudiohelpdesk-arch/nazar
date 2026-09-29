import { Injectable } from '@nestjs/common';
import type {
  IPushNotificationProvider,
  PushNotificationRequest,
} from './push-provider.interface.js';
import type { PushDeliveryResult, PushProviderType } from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class MockPushProvider implements IPushNotificationProvider {
  readonly name = 'MockPushProvider';
  readonly providerType: PushProviderType = 'APNS';

  private sent: PushNotificationRequest[] = [];
  private scriptedResponses: Map<string, PushDeliveryResult> = new Map();

  constructor(providerType: PushProviderType = 'APNS') {
    this.providerType = providerType;
  }

  async send(req: PushNotificationRequest): Promise<PushDeliveryResult> {
    this.sent.push(req);

    if (this.scriptedResponses.has(req.token)) {
      return this.scriptedResponses.get(req.token)!;
    }

    if (req.token.includes('invalid') || req.token.includes('bad_token')) {
      return {
        success: false,
        errorCategory: 'TOKEN_INVALID',
        errorMessage: 'Invalid device registration token',
        isPermanentFailure: true,
      };
    }

    if (req.token.includes('timeout')) {
      return {
        success: false,
        errorCategory: 'TIMEOUT',
        errorMessage: 'Push service request timed out',
        isPermanentFailure: false,
      };
    }

    if (req.token.includes('rate_limit')) {
      return {
        success: false,
        errorCategory: 'RATE_LIMITED',
        errorMessage: 'Too many requests to push gateway',
        isPermanentFailure: false,
      };
    }

    return {
      success: true,
      providerMessageId: `mock-${this.providerType.toLowerCase()}-${generateUuidV7()}`,
      isPermanentFailure: false,
    };
  }

  getSent(): readonly PushNotificationRequest[] {
    return [...this.sent];
  }

  getLastSent(): PushNotificationRequest | undefined {
    return this.sent[this.sent.length - 1];
  }

  scriptResponse(token: string, result: PushDeliveryResult): void {
    this.scriptedResponses.set(token, result);
  }

  clear(): void {
    this.sent = [];
    this.scriptedResponses.clear();
  }
}
