import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  readonly message: string;
  readonly type?: ToastType;
  readonly duration?: number;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly testID?: string;
}

export interface ToastContextValue {
  readonly showToast: (options: ToastOptions | string) => void;
  readonly hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    return {
      showToast: () => {},
      hideToast: () => {},
    };
  }
  return ctx;
};

export interface ToastProps {
  readonly message: string;
  readonly type?: ToastType;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onClose?: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  actionLabel,
  onAction,
  onClose,
  style,
  testID,
}) => {
  const { colors, radii, spacing, shadows } = useTheme();

  const getIconAndColor = (): { icon: IconName; color: string; bg: string } => {
    switch (type) {
      case 'success':
        return { icon: 'check', color: colors.success, bg: colors.surface };
      case 'error':
        return { icon: 'warning', color: colors.error, bg: colors.surface };
      case 'warning':
        return { icon: 'warning', color: colors.warning, bg: colors.surface };
      case 'info':
      default:
        return { icon: 'info', color: colors.accent, bg: colors.surface };
    }
  };

  const { icon, color, bg } = getIconAndColor();

  return (
    <View
      style={[
        styles.toastContainer,
        {
          backgroundColor: bg,
          borderColor: colors.borderStrong,
          borderRadius: radii.radiusLG,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          ...shadows.shadowMD,
        },
        style,
      ]}
      testID={testID || 'feedback.toast'}
      accessibilityRole="alert"
      accessibilityLabel={`${type} notification: ${message}`}
    >
      <Icon name={icon} size="sm" color={color} style={{ marginRight: spacing.sm }} />

      <Text
        variant="bodySmall"
        weight="medium"
        style={{ color: colors.textPrimary, flex: 1 }}
        numberOfLines={2}
      >
        {message}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={{ marginLeft: spacing.sm }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text variant="caption" weight="bold" style={{ color: colors.accent }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}

      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={{ marginLeft: spacing.xs, padding: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss toast"
        >
          <Icon name="close" size="tiny" color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export interface ToastProviderProps {
  readonly children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentToast(null);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions | string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const opts: ToastOptions =
        typeof options === 'string' ? { message: options } : options;

      setCurrentToast(opts);

      const duration = opts.duration ?? 3500;
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          setCurrentToast(null);
        }, duration);
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {currentToast && (
        <View
          style={[
            styles.floatingWrapper,
            { bottom: Math.max(insets.bottom, 16) + 60 },
          ]}
          pointerEvents="box-none"
        >
          <Toast
            message={currentToast.message}
            type={currentToast.type}
            actionLabel={currentToast.actionLabel}
            onAction={() => {
              currentToast.onAction?.();
              hideToast();
            }}
            onClose={hideToast}
            testID={currentToast.testID}
          />
        </View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
  },
});
