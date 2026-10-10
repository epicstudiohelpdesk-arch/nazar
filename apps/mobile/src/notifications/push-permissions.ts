/**
 * Push permission state machine and foreground policy.
 *
 * Kept free of any `expo-notifications` import so every decision here is unit
 * testable. {@link ../push-runtime.js} is the only module that touches the
 * native module, and it feeds raw platform status strings in here.
 *
 * The previous `NotificationManager.requestPermission()` simply assigned
 * `'AUTHORIZED'` without calling the OS, so the app could display "push
 * enabled" while the user had never been asked. Nothing in this file invents
 * permission: the platform is the only source, and an unknown value resolves to
 * `not_requested` rather than to an optimistic "granted".
 */

/**
 * `blocked` is not an expo status: it is what the app concludes when the OS
 * reports denied and a re-request would not re-prompt (iOS only prompts once,
 * permanently; Android may route the user to settings instead). Distinguishing
 * it lets the UI offer "Open Settings" rather than a button that does nothing.
 */
export type PushPermissionState =
  'not_requested' | 'granted' | 'provisional' | 'denied' | 'blocked' | 'unsupported';

export const PERMISSION_STATES: readonly PushPermissionState[] = [
  'not_requested',
  'granted',
  'provisional',
  'denied',
  'blocked',
  'unsupported',
];

/**
 * Raw `expo-notifications` `PermissionStatus` strings, plus the app's own.
 *
 * "Never asked" is read from `undetermined` rather than from a stored flag, so
 * the state cannot drift from what the OS actually reports.
 */
export function mapPermissionStatus(status: string | null | undefined): PushPermissionState {
  switch (status) {
    case 'granted':
      return 'granted';
    // iOS "Deliver Quietly" and App Clip ephemeral grants both deliver without
    // a full user opt-in, so they are authorised but must not be reported as a
    // complete grant.
    case 'provisional':
    case 'ephemeral':
      return 'provisional';
    case 'denied':
      return 'denied';
    case 'blocked':
      return 'blocked';
    case 'undetermined':
    case undefined:
    case null:
      return 'not_requested';
    default:
      // An unknown future status is treated as "not asked" so the app never
      // claims push is enabled on a platform that may have withheld it.
      return 'not_requested';
  }
}

export interface PermissionPresentation {
  /** Whether the app should still offer the "Enable notifications" action. */
  readonly canRequest: boolean;
  /** Whether a route into OS settings should be offered. */
  readonly shouldOfferSystemSettings: boolean;
  readonly headline: string;
  readonly detail: string;
  readonly primaryActionLabel: string | null;
}

/**
 * Copy for the permission card.
 *
 * A denied user is never re-prompted: on iOS the prompt is one-shot, so
 * offering it again produces a button that appears broken.
 */
export function describePermissionState(
  state: PushPermissionState,
  options: { readonly requestedBefore?: boolean } = {}
): PermissionPresentation {
  switch (state) {
    case 'granted':
      return {
        canRequest: false,
        shouldOfferSystemSettings: false,
        headline: 'Push is on',
        detail: 'New matches, messages and community activity can reach you on this device.',
        primaryActionLabel: null,
      };
    case 'provisional':
      return {
        canRequest: false,
        shouldOfferSystemSettings: true,
        headline: 'Push is quiet',
        detail: 'Notifications arrive silently. Open settings to switch to immediate delivery.',
        primaryActionLabel: 'Open Settings',
      };
    case 'denied':
      return {
        canRequest: options.requestedBefore === true,
        shouldOfferSystemSettings: true,
        headline: 'Push is off',
        detail:
          options.requestedBefore === true
            ? 'Your device is blocking notifications. You can turn them back on in Settings.'
            : 'Notifications are turned off for Nazar on this device.',
        primaryActionLabel: options.requestedBefore === true ? 'Open Settings' : null,
      };
    case 'blocked':
      return {
        canRequest: false,
        shouldOfferSystemSettings: true,
        headline: 'Push is blocked',
        detail: 'This device is blocking notifications for Nazar. Change it in Settings.',
        primaryActionLabel: 'Open Settings',
      };
    case 'unsupported':
      return {
        canRequest: false,
        shouldOfferSystemSettings: false,
        headline: 'Push unavailable here',
        detail:
          'Push delivery needs the Nazar app on a phone. Your activity centre works the same way.',
        primaryActionLabel: null,
      };
    case 'not_requested':
    default:
      return {
        canRequest: true,
        shouldOfferSystemSettings: false,
        headline: 'Stay in the loop',
        detail:
          'Get notified about new matches, messages, and important community and event updates.',
        primaryActionLabel: 'Enable notifications',
      };
  }
}

/**
 * Whether a device should be registered for push right now.
 *
 * Registration is attempted only when the OS has actually granted delivery. A
 * local token alone is never treated as consent, and a simulator has no real
 * push endpoint, so it is excluded.
 */
export function shouldRegisterDevice(input: {
  readonly permission: PushPermissionState;
  readonly isPhysicalDevice: boolean;
  readonly runtimeAvailable: boolean;
}): boolean {
  return (
    input.runtimeAvailable &&
    input.isPhysicalDevice &&
    (input.permission === 'granted' || input.permission === 'provisional')
  );
}

/**
 * What to do with a notification that arrives while the app is foregrounded.
 *
 * The native banner is suppressed so a foregrounded user is not interrupted, and
 * no replacement in-app banner is raised either. The badge and the Activity
 * Center cache are still updated, so the information is available without the
 * screen presenting a second and third competing surface for the same event.
 */
export type ForegroundAction = 'suppress-native-and-banner' | 'ignore';

export function decideForegroundAction(input: {
  readonly isForeground: boolean;
  readonly category: 'message' | 'other';
}): ForegroundAction {
  if (!input.isForeground) return 'ignore';
  return 'suppress-native-and-banner';
}

export interface ForegroundPresentationDecision {
  readonly showBanner: boolean;
  readonly playSound: boolean;
  readonly shouldReconcile: boolean;
}

export function shouldPresentForegroundNotification(input: {
  readonly appState: 'active' | 'background' | 'inactive' | string;
  readonly permission: PushPermissionState | string;
}): ForegroundPresentationDecision {
  if (input.appState === 'active') {
    return { showBanner: false, playSound: false, shouldReconcile: true };
  }
  return { showBanner: true, playSound: true, shouldReconcile: true };
}

/**
 * Whether a foreground push should be inserted into the Activity Center cache
 * straight away. It always should: the row is already committed server-side.
 */
export function shouldReconcileForegroundPush(input: {
  readonly isAuthenticated: boolean;
}): boolean {
  return input.isAuthenticated;
}
