import type { PushProviderType, PushDeliveryResult } from '@platform/api-contracts';

export interface PushNotificationRequest {
  readonly token: string;
  readonly platform: 'IOS' | 'ANDROID';
  readonly provider: PushProviderType;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  readonly category?: string;
  readonly collapseKey?: string;
  readonly badge?: number;
}

export interface IPushNotificationProvider {
  readonly name: string;
  readonly providerType: PushProviderType;
  send(req: PushNotificationRequest): Promise<PushDeliveryResult>;
}

export const APNS_PROVIDER_TOKEN = Symbol('IApnsPushProvider');
export const FCM_PROVIDER_TOKEN = Symbol('IFcmPushProvider');
export const PUSH_DISPATCHER_TOKEN = Symbol('IPushDispatcher');
