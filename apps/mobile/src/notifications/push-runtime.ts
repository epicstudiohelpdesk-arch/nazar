/**
 * The only module that talks to `expo-notifications` and `expo-device`.
 *
 * Everything is imported lazily and behind a capability check. The mobile test
 * runner uses `environment: 'node'` and the app also runs in Expo Go and on web,
 * where the native module is absent. A missing module therefore resolves to
 * `runtimeAvailable: false` and the rest of the feature degrades to the
 * Activity Center rather than crashing at import time.
 *
 * Device tokens are treated as secrets: they are passed straight to
 * `POST /v1/devices`, never logged, never stored, and never placed in analytics.
 */
import { Platform } from 'react-native';
import { buildDeviceDescriptor, type DeviceDescriptor } from './device-identity.js';
import {
  mapPermissionStatus,
  shouldRegisterDevice,
  type PushPermissionState,
} from './push-permissions.js';
import type { NotificationIntent } from './notification-payload.js';

type PushSubscription = { remove: () => void };

/**
 * The slice of the native modules this file uses. Declared structurally so the
 * runtime can pass a real module or the test double without a cast.
 */
interface NotificationsModule {
  setNotificationHandler(handler: {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getDevicePushTokenAsync(): Promise<{ data: string }>;
  setBadgeCountAsync(count: number): Promise<void>;
  setNotificationChannelAsync(channel: {
    identifier: string;
    name: string;
    importance: number;
    data: { importance: number } | null;
  }): Promise<unknown>;
  addNotificationReceivedListener(listener: (event: unknown) => void): PushSubscription;
  addNotificationResponseReceivedListener(listener: (event: unknown) => void): PushSubscription;
}

interface DeviceModule {
  isDevice: boolean;
  Device: { osVersion: string | number; modelId: string | null; deviceName: string | null };
}

let notificationsModule: NotificationsModule | null = null;
let deviceModule: DeviceModule | null = null;
let loadAttempted = false;

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (loadAttempted) return notificationsModule;
  loadAttempted = true;
  try {
    const mod = (await import('expo-notifications')) as unknown as NotificationsModule;
    notificationsModule = mod;
  } catch {
    // Expo Go, web, or a native build without the module linked.
    notificationsModule = null;
  }
  return notificationsModule;
}

async function loadDeviceModule(): Promise<DeviceModule | null> {
  try {
    const mod = (await import('expo-device')) as unknown as DeviceModule;
    deviceModule = mod;
  } catch {
    deviceModule = null;
  }
  return deviceModule;
}

export function isPushRuntimeAvailable(): boolean {
  return notificationsModule !== null;
}

export const ANDROID_NOTIFICATION_CHANNEL = {
  identifier: 'nazar-activity',
  name: 'Matches, messages & activity',
  importance: 4,
} as const;

/**
 * Installs the foreground handler and the Android channel.
 *
 * Foreground banners are suppressed on purpose: the Activity Center and the
 * badge already carry the event, and a native banner plus an in-app banner would
 * present the same notification twice while the user is looking at the screen.
 */
export async function configurePushRuntime(): Promise<boolean> {
  const mod = await loadNotificationsModule();
  if (!mod) return false;

  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await mod.setNotificationChannelAsync({
      identifier: ANDROID_NOTIFICATION_CHANNEL.identifier,
      name: ANDROID_NOTIFICATION_CHANNEL.name,
      importance: ANDROID_NOTIFICATION_CHANNEL.importance,
      data: { importance: ANDROID_NOTIFICATION_CHANNEL.importance },
    });
  }

  return true;
}

export async function getCurrentPushPermission(): Promise<PushPermissionState> {
  const mod = await loadNotificationsModule();
  if (!mod) return 'unsupported';
  try {
    const { status } = await mod.getPermissionsAsync();
    return mapPermissionStatus(status);
  } catch {
    return 'unsupported';
  }
}

/**
 * Prompts the OS, once. The result is whatever the platform reports; the app
 * never overrides it, and a refusal is not retried automatically.
 */
export async function requestPushPermission(): Promise<PushPermissionState> {
  const mod = await loadNotificationsModule();
  if (!mod) return 'unsupported';
  try {
    const current = await mod.getPermissionsAsync();
    if (mapPermissionStatus(current.status) === 'granted') return 'granted';
    const requested = await mod.requestPermissionsAsync();
    return mapPermissionStatus(requested.status);
  } catch {
    return 'denied';
  }
}

export interface PushDeviceSnapshot {
  readonly permission: PushPermissionState;
  readonly isPhysicalDevice: boolean;
  readonly runtimeAvailable: boolean;
  /** Present only when push is actually deliverable on this device. */
  readonly descriptor: DeviceDescriptor | null;
  readonly pushToken: string | null;
  readonly skipReason: 'no_permission' | 'simulator' | 'runtime_unavailable' | 'ok';
}

export interface PushDeviceProbeOptions {
  readonly appVersion?: string;
  readonly locale?: string;
  readonly timezone?: string;
}

/**
 * Reads the current permission and, when push is genuinely deliverable, the
 * native token.
 *
 * No token is requested unless the OS has granted delivery, so an unprompted
 * user is never registered.
 */
export async function probePushDevice(
  options: PushDeviceProbeOptions = {}
): Promise<PushDeviceSnapshot> {
  const mod = await loadNotificationsModule();
  const dev = await loadDeviceModule();
  const runtimeAvailable = mod !== null;

  if (!mod) {
    return {
      permission: 'unsupported',
      isPhysicalDevice: dev?.isDevice ?? false,
      runtimeAvailable: false,
      descriptor: null,
      pushToken: null,
      skipReason: 'runtime_unavailable',
    };
  }

  let permission: PushPermissionState = 'unsupported';
  try {
    permission = mapPermissionStatus((await mod.getPermissionsAsync()).status);
  } catch {
    permission = 'unsupported';
  }

  const isPhysicalDevice = dev?.isDevice ?? false;

  if (!shouldRegisterDevice({ permission, isPhysicalDevice, runtimeAvailable: true })) {
    return {
      permission,
      isPhysicalDevice,
      runtimeAvailable,
      descriptor: null,
      pushToken: null,
      skipReason: isPhysicalDevice ? 'no_permission' : 'simulator',
    };
  }

  try {
    const { data: token } = await mod.getDevicePushTokenAsync();
    const os = Platform.OS === 'android' ? 'android' : 'ios';
    const descriptor = buildDeviceDescriptor({
      os,
      pushToken: token,
      osVersion:
        dev?.Device.osVersion !== undefined
          ? String(dev.Device.osVersion)
          : String(Platform.Version ?? ''),
      appVersion: options.appVersion,
      locale: options.locale,
      timezone: options.timezone,
    });
    return {
      permission,
      isPhysicalDevice,
      runtimeAvailable,
      descriptor,
      pushToken: token,
      skipReason: 'ok',
    };
  } catch {
    return {
      permission,
      isPhysicalDevice,
      runtimeAvailable,
      descriptor: null,
      pushToken: null,
      // A token failure is a registration problem, not a permission problem.
      skipReason: isPhysicalDevice ? 'ok' : 'simulator',
    };
  }
}

/**
 * Applies the authoritative unread total to the OS badge.
 *
 * The Gate 10 delivery worker never sets a badge, so the app owns it and sources
 * it from the server's unread count rather than from a local tally.
 */
export async function applyBadgeCount(count: number): Promise<void> {
  const mod = await loadNotificationsModule();
  if (!mod) return;
  const safe = Math.max(0, Math.trunc(count));
  try {
    await mod.setBadgeCountAsync(safe);
  } catch {
    // A failed badge write is cosmetic and must not surface an error.
  }
}

export function clearBadge(): Promise<void> {
  return applyBadgeCount(0);
}

export interface PushListeners {
  /** Fired when a notification arrives while the app is in the foreground. */
  readonly onReceived?: (payload: unknown) => void;
  /**
   * Fired when the user taps a notification. Covers cold start, where the
   * listener is attached only after the app has mounted.
   */
  readonly onResponse?: (payload: unknown) => void;
}

export function subscribeToPush(listeners: PushListeners): () => void {
  const subscriptions: PushSubscription[] = [];
  let cancelled = false;

  const attach = async (): Promise<void> => {
    const mod = await loadNotificationsModule();
    if (!mod || cancelled) return;
    if (listeners.onReceived) {
      subscriptions.push(
        mod.addNotificationReceivedListener((event) => {
          const content = (
            event as { notification?: { request?: { content?: { data?: unknown } } } }
          )?.notification?.request?.content;
          listeners.onReceived?.(content?.data ?? null);
        })
      );
    }
    if (listeners.onResponse) {
      subscriptions.push(
        mod.addNotificationResponseReceivedListener((event) => {
          const content = (
            event as { notification?: { request?: { content?: { data?: unknown } } } }
          )?.notification?.request?.content;
          listeners.onResponse?.(content?.data ?? null);
        })
      );
    }
  };

  void attach();

  return () => {
    cancelled = true;
    for (const subscription of subscriptions) {
      try {
        subscription.remove();
      } catch {
        // Removing a listener on an already-torn-down module is not an error.
      }
    }
  };
}

/**
 * The payload the OS handed us at launch, if the app was started by a tap.
 * `null` when the app was opened normally.
 */
export function getColdStartIntent(): unknown {
  const mod = notificationsModule;
  if (!mod) return null;
  const response = (
    mod as unknown as {
      getLastNotificationResponse?: () => {
        notification: { request: { content: { data: unknown } } };
      } | null;
    }
  ).getLastNotificationResponse?.();
  return response?.notification?.request?.content?.data ?? null;
}

export type { NotificationIntent };
