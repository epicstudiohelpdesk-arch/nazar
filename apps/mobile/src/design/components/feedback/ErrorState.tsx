import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { Button } from '../button/Button.js';

export type ErrorStateType =
  | 'network_unavailable'
  | 'server_error'
  | 'auth_expired'
  | 'content_unavailable'
  | 'permission_denied'
  | 'rate_limited'
  | 'payment_failed'
  | 'media_failed'
  | 'unknown';

export interface ErrorStateProps {
  readonly type?: ErrorStateType;
  readonly title?: string;
  readonly message?: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

interface ErrorContent {
  title: string;
  message: string;
  icon: IconName;
  retryLabel: string;
}

const ERROR_STATE_CONFIG: Record<ErrorStateType, ErrorContent> = {
  network_unavailable: {
    title: 'No Internet Connection',
    message:
      'Please check your cellular data or Wi-Fi settings. Your offline drafts and recent matches are preserved.',
    icon: 'warning',
    retryLabel: 'Try Reconnecting',
  },
  server_error: {
    title: 'Temporary Server Glitch',
    message:
      'Our matchmaking service is experiencing a brief hiccup. We are already looking into it. Please try again in a moment.',
    icon: 'warning',
    retryLabel: 'Retry',
  },
  auth_expired: {
    title: 'Session Expired',
    message:
      'For your account safety and privacy, your session has timed out. Please sign in again to continue.',
    icon: 'lock',
    retryLabel: 'Sign In Again',
  },
  content_unavailable: {
    title: 'Content No Longer Available',
    message: 'This profile, post, or event has been removed or is no longer accessible.',
    icon: 'close',
    retryLabel: 'Back to Discovery',
  },
  permission_denied: {
    title: 'Permission Needed',
    message:
      'Nazar needs permission to access your location or camera to complete this action safely. You can update this in settings.',
    icon: 'shield',
    retryLabel: 'Open Settings',
  },
  rate_limited: {
    title: 'Taking a Quick Breather',
    message:
      'You are moving faster than usual. To ensure thoughtful interactions and platform safety, please wait a moment.',
    icon: 'info',
    retryLabel: 'Refresh',
  },
  payment_failed: {
    title: 'Payment Incomplete',
    message:
      'Your transaction could not be processed by your bank or UPI app. No charges were deducted.',
    icon: 'warning',
    retryLabel: 'Retry Payment',
  },
  media_failed: {
    title: 'Media Failed to Load',
    message:
      'We could not load high-resolution imagery due to network instability. Tap below to reload.',
    icon: 'camera',
    retryLabel: 'Reload Media',
  },
  unknown: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or restart the application.',
    icon: 'warning',
    retryLabel: 'Try Again',
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'unknown',
  title,
  message,
  retryLabel,
  onRetry,
  isRetrying = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const config = ERROR_STATE_CONFIG[type];

  const resolvedTitle = title || config.title;
  const resolvedMessage = message || config.message;
  const resolvedRetryLabel = retryLabel || config.retryLabel;

  return (
    <View
      style={[styles.container, { padding: spacing.xl }, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={`${resolvedTitle}. ${resolvedMessage}`}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.errorSoft,
            borderColor: colors.error,
            borderRadius: radii.radiusFull,
          },
        ]}
      >
        <Icon name={config.icon} size="lg" color={colors.error} />
      </View>

      <Heading level="h3" align="center" style={{ marginTop: spacing.md }}>
        {resolvedTitle}
      </Heading>

      <Text
        variant="body"
        align="center"
        style={{
          color: colors.textSecondary,
          marginTop: spacing.xs,
          marginBottom: spacing.lg,
          lineHeight: 22,
        }}
      >
        {resolvedMessage}
      </Text>

      {onRetry && (
        <Button
          label={resolvedRetryLabel}
          variant="secondary"
          size="md"
          loading={isRetrying}
          onPress={onRetry}
        />
      )}
    </View>
  );
};

// Convenience Error State Components
export interface InlineErrorProps {
  readonly message: string;
  readonly onRetry?: () => void;
  readonly style?: ViewStyle;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, onRetry, style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[styles.inlineError, { paddingVertical: spacing.xs }, style]}
      accessibilityRole="alert"
    >
      <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: spacing.xs }} />
      <Text variant="caption" style={{ color: colors.error, flex: 1 }}>
        {message}
      </Text>
      {onRetry && (
        <Button
          label="Retry"
          variant="tertiary"
          size="sm"
          onPress={onRetry}
          textStyle={{ color: colors.accent, fontWeight: 'bold' }}
        />
      )}
    </View>
  );
};

export const NetworkErrorState: React.FC<Omit<ErrorStateProps, 'type'>> = (props) => (
  <ErrorState type="network_unavailable" {...props} />
);

export const RetryState: React.FC<ErrorStateProps> = (props) => <ErrorState {...props} />;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});
