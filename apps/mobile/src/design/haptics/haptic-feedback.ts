import { Vibration, Platform } from 'react-native';

export type HapticCategory = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

class HapticManager {
  private isEnabled: boolean = true;
  private lastTriggerTime: number = 0;
  private minIntervalMs: number = 100; // Debounce threshold to prevent duplicate sensations

  /**
   * Enable or disable haptic feedback globally.
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Resets debounce timer (primarily for unit tests and rapid context switching).
   */
  clearDebounce(): void {
    this.lastTriggerTime = 0;
  }

  /**
   * Internal dispatcher with debouncing and platform safety checks.
   */
  private trigger(category: HapticCategory, androidDurationOrPattern: number | number[]): void {
    if (!this.isEnabled) return;

    // Node / Vitest safety check
    if (typeof Vibration === 'undefined' || !Vibration?.vibrate) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTriggerTime < this.minIntervalMs) {
      return;
    }
    this.lastTriggerTime = now;

    try {
      const isAndroid = typeof Platform !== 'undefined' && Platform?.OS === 'android';
      if (isAndroid) {
        Vibration.vibrate(androidDurationOrPattern);
      } else {
        // iOS / default fallback
        if (category === 'error' || category === 'warning') {
          Vibration.vibrate([0, 40, 60, 40]);
        } else if (category === 'success') {
          Vibration.vibrate([0, 30, 40, 30]);
        } else {
          Vibration.vibrate(15);
        }
      }
    } catch {
      // Graceful no-op on unsupported hardware/simulators
    }
  }

  /**
   * Light feedback: Selection, toggle, filter change, small confirmation.
   */
  selection(): void {
    this.trigger('selection', 10);
  }

  /**
   * Light impact: Tab change, chip press, subtle feedback.
   */
  light(): void {
    this.trigger('light', 15);
  }

  /**
   * Medium feedback: Like action, important confirmation, RSVP, meaningful state change.
   */
  medium(): void {
    this.trigger('medium', 30);
  }

  /**
   * Strong/Success feedback: Successful match, completed purchase, significant milestone.
   */
  success(): void {
    this.trigger('success', [0, 35, 60, 45]);
  }

  /**
   * Warning feedback: Form validation warning, boundary warning.
   */
  warning(): void {
    this.trigger('warning', [0, 40, 50, 40]);
  }

  /**
   * Error feedback: Payment failure, destructive deletion prompt, block confirmation.
   */
  error(): void {
    this.trigger('error', [0, 50, 60, 50, 60, 50]);
  }
}

export const haptics = new HapticManager();
