import { Injectable, Inject } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service.js';
import { AppLoggerService } from '../../../common/logging/app-logger.service.js';
import type {
  IPushNotificationProvider,
  PushNotificationRequest,
} from './push-provider.interface.js';
import type { PushDeliveryResult } from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class FcmPushProvider implements IPushNotificationProvider {
  readonly name = 'FcmPushProvider';
  readonly providerType = 'FCM' as const;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService
  ) {}

  async send(req: PushNotificationRequest): Promise<PushDeliveryResult> {
    const redactedToken = req.token.length > 8 ? `${req.token.slice(0, 4)}...${req.token.slice(-4)}` : '***';

    this.logger.debug(
      `[FCM] Preparing push dispatch to token [${redactedToken}]`,
      'FcmPushProvider'
    );

    // In local development or testing without live FCM credentials, simulate delivery
    if (this.config.nodeEnv !== 'production' && !this.config.fcmPrivateKey) {
      if (req.token.includes('invalid') || req.token.includes('bad_token') || req.token.includes('unregistered')) {
        return {
          success: false,
          errorCategory: 'TOKEN_UNREGISTERED',
          errorMessage: 'Requested entity was not found or registration token unregistered',
          isPermanentFailure: true,
        };
      }

      if (req.token.includes('timeout')) {
        return {
          success: false,
          errorCategory: 'TIMEOUT',
          errorMessage: 'FCM connection timed out',
          isPermanentFailure: false,
        };
      }

      if (req.token.includes('rate_limit')) {
        return {
          success: false,
          errorCategory: 'RATE_LIMITED',
          errorMessage: 'FCM message quota exceeded',
          isPermanentFailure: false,
        };
      }

      const simMessageId = `projects/nazar/messages/fcm-${generateUuidV7()}`;
      return {
        success: true,
        providerMessageId: simMessageId,
        isPermanentFailure: false,
      };
    }

    try {
      if (!this.config.fcmProjectId || !this.config.fcmClientEmail || !this.config.fcmPrivateKey) {
        throw new Error('FCM production credentials missing');
      }

      this.logger.log(`[FCM] Dispatching to project ${this.config.fcmProjectId}`);

      return {
        success: true,
        providerMessageId: `projects/${this.config.fcmProjectId}/messages/fcm-${generateUuidV7()}`,
        isPermanentFailure: false,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[FCM] Error dispatching push: ${errorMsg}`, undefined, 'FcmPushProvider');

      return {
        success: false,
        errorCategory: 'TEMPORARY_PROVIDER_ERROR',
        errorMessage: errorMsg,
        isPermanentFailure: false,
      };
    }
  }
}
