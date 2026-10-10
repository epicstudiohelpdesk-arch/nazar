/**
 * `expo-notifications` test double.
 *
 * The real module touches native bindings at import time, and the mobile test
 * runner uses `environment: 'node'`, so it cannot be loaded directly. This mock
 * exposes the same surface the push runtime uses and records calls so tests can
 * assert registration, permission and badge behaviour.
 */

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
  GRANTED: 'granted',
  PROVISIONAL: 'provisional',
  EPHEMERAL: 'ephemeral',
} as const;

export const AndroidImportance = {
  DEFAULT: 3,
  HIGH: 4,
} as const;

export const AndroidNotificationPriority = {
  HIGH: 'high',
} as const;

export interface EmitterSubscription {
  remove: () => void;
}

interface Recorded {
  readonly added: string[];
  readonly presented: string[];
  readonly responded: unknown[];
  readonly badgeCalls: number[];
  readonly channels: { identifier: string; name: string; importance: number }[];
  readonly scheduled: { identifier: string; title: string; body: string }[];
}

export const __recorded: Recorded = {
  added: [],
  presented: [],
  responded: [],
  badgeCalls: [],
  channels: [],
  scheduled: [],
};

export function __reset(): void {
  __recorded.added.length = 0;
  __recorded.presented.length = 0;
  __recorded.responded.length = 0;
  __recorded.badgeCalls.length = 0;
  __recorded.channels.length = 0;
  __recorded.scheduled.length = 0;
}

/** Test-controllable permission answer for the next `requestPermissionsAsync`. */
export let nextPermissionRequest: string = PermissionStatus.GRANTED;
export function __setPermissionRequest(status: string): void {
  nextPermissionRequest = status;
}

/** Test-controllable current permission for `getPermissionsAsync`. */
export let currentPermission: string = PermissionStatus.UNDETERMINED;
export function __setPermission(status: string): void {
  currentPermission = status;
}

export let devicePushToken: string = 'ExponentPushToken[test-token]';
export function __setDevicePushToken(token: string): void {
  devicePushToken = token;
}

export function setNotificationHandler(): void {
  /* no-op */
}

export async function getPermissionsAsync(): Promise<{ status: string }> {
  return { status: currentPermission };
}

export async function requestPermissionsAsync(): Promise<{ status: string }> {
  currentPermission = nextPermissionRequest;
  return { status: currentPermission };
}

export async function getDevicePushTokenAsync(): Promise<{ data: string }> {
  return { data: devicePushToken };
}

export async function getExpoPushTokenAsync(): Promise<{ data: string }> {
  return { data: devicePushToken };
}

export async function setBadgeCountAsync(count: number): Promise<void> {
  __recorded.badgeCalls.push(count);
}

export async function setNotificationChannelAsync(channel: {
  identifier: string;
  name: string;
  importance: number;
}): Promise<unknown> {
  __recorded.channels.push(channel);
  return channel;
}

export function addNotificationReceivedListener(
  listener: (event: unknown) => void
): EmitterSubscription {
  __recorded.added.push('received');
  return { remove: () => undefined };
}

export function addNotificationPresentedListener(
  listener: (event: unknown) => void
): EmitterSubscription {
  __recorded.added.push('presented');
  return { remove: () => undefined };
}

export function addNotificationResponseReceivedListener(
  listener: (event: unknown) => void
): EmitterSubscription {
  __recorded.added.push('response');
  return { remove: () => undefined };
}

export function addNotificationChannelUpdatedListener(): EmitterSubscription {
  return { remove: () => undefined };
}

export async function presentNotificationAsync(request: {
  content: { title: string; body: string };
}): Promise<string> {
  __recorded.presented.push(request.content.title);
  return 'presented-id';
}

export async function scheduleNotificationAsync(request: {
  content: { title: string; body: string };
}): Promise<string> {
  __recorded.scheduled.push(request.content);
  return 'scheduled-id';
}

export function getLastNotificationResponse(): {
  notification: { request: { content: { data: unknown } } };
} | null {
  return null;
}
