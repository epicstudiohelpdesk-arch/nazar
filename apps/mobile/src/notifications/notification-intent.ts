/**
 * Pending notification intent.
 *
 * A push tap can arrive before the app has an authenticated session. Calling
 * `router.push()` at that moment races the session restore in `app/index.tsx`:
 * the route is pushed, then the bootstrap's `router.replace()` lands on the
 * default tab, and the notification silently evaporates. This module holds the
 * intent outside React so it survives until the bootstrap decides what to do.
 *
 * Rules:
 * - The intent is consumed exactly once. A second `consume()` returns `null`.
 * - If the session is not active the intent is **discarded**, never replayed
 *   after sign-in. Notifications are per-user, so a tap belonging to the previous
 *   account must not open a screen in the next one.
 * - Resolution never fetches. The destination screen loads authoritative state.
 */
import type { NotificationIntent } from './notification-payload.js';

type Listener = (intent: NotificationIntent | null) => void;

let pending: NotificationIntent | null = null;
let consumed = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener(pending);
  }
}

export function setPendingNotificationIntent(intent: NotificationIntent | null): void {
  if (intent === null) {
    return;
  }
  pending = intent;
  consumed = false;
  emit();
}

export function getPendingNotificationIntent(): NotificationIntent | null {
  return pending;
}

/** Reads and clears the intent. Returns `null` on the second call. */
export function consumePendingNotificationIntent(): NotificationIntent | null {
  if (consumed) return null;
  consumed = true;
  const intent = pending;
  pending = null;
  if (intent) emit();
  return intent;
}

/** Drops the intent without navigating, e.g. for an unauthenticated session. */
export function clearPendingNotificationIntent(): void {
  if (pending === null) return;
  pending = null;
  consumed = true;
  emit();
}

export function subscribeToPendingNotificationIntent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: drops all state between cases. */
export function __resetPendingNotificationIntent(): void {
  pending = null;
  consumed = false;
  listeners.clear();
}
