import type {
  AuthTokensResponse,
  GenericAuthNoticeResponse,
  VerifyOtpPayload,
  VerifyEmailPayload,
  GoogleAuthPayload,
  AppleAuthPayload,
  PasskeyLoginOptionsResponse,
  PasskeyLoginVerifyPayload,
  DeviceRegistrationPayload,
} from '@platform/api-contracts';
import { getDefaultAuthClient } from './default-client.js';
import type { AuthClient } from './auth-client.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface AuthOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  isRateLimited?: boolean;
  retryAfterSeconds?: number;
}

export class AuthService {
  constructor(private readonly client: AuthClient = getDefaultAuthClient()) {}

  /**
   * Request an OTP for phone number.
   */
  async requestPhoneOtp(
    phoneNumber: string,
    deviceId?: string
  ): Promise<AuthOperationResult<GenericAuthNoticeResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'phone' });

    try {
      const res = await this.client.request<GenericAuthNoticeResponse>('/v1/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, deviceId }),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'phone');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'phone');
    }
  }

  /**
   * Verify phone number OTP and establish user session.
   */
  async verifyPhoneOtp(
    phoneNumber: string,
    code: string,
    device?: DeviceRegistrationPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    try {
      const payload: VerifyOtpPayload = { phoneNumber, code, device };
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'phone_verify');
      }

      // Store tokens securely
      await this.persistTokens(res.data);
      trackOnboardingEvent('auth_succeeded', {
        method: 'phone',
        isNewUser: res.data.user.isNewUser,
      });

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'phone_verify');
    }
  }

  /**
   * Request email verification link or code.
   */
  async requestEmailVerification(
    email: string
  ): Promise<AuthOperationResult<GenericAuthNoticeResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'email' });

    try {
      const res = await this.client.request<GenericAuthNoticeResponse>(
        '/v1/auth/email/request-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );

      if (!res.success) {
        return this.handleApiError(res.error, 'email');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'email');
    }
  }

  /**
   * Verify email verification code and establish user session.
   */
  async verifyEmail(
    email: string,
    code: string,
    device?: DeviceRegistrationPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    try {
      const payload: VerifyEmailPayload = { email, code, device };
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'email_verify');
      }

      await this.persistTokens(res.data);
      trackOnboardingEvent('auth_succeeded', {
        method: 'email',
        isNewUser: res.data.user.isNewUser,
      });

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'email_verify');
    }
  }

  /**
   * Authenticate via Google ID token.
   */
  async loginWithGoogle(
    payload: GoogleAuthPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'google' });

    try {
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'google');
      }

      await this.persistTokens(res.data);
      trackOnboardingEvent('auth_succeeded', {
        method: 'google',
        isNewUser: res.data.user.isNewUser,
      });

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'google');
    }
  }

  /**
   * Authenticate via Apple ID token.
   */
  async loginWithApple(payload: AppleAuthPayload): Promise<AuthOperationResult<AuthTokensResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'apple' });

    try {
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/oauth/apple', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'apple');
      }

      await this.persistTokens(res.data);
      trackOnboardingEvent('auth_succeeded', {
        method: 'apple',
        isNewUser: res.data.user.isNewUser,
      });

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'apple');
    }
  }

  /**
   * Request Passkey login options challenge.
   */
  async getPasskeyLoginOptions(
    emailOrPhone?: string
  ): Promise<AuthOperationResult<PasskeyLoginOptionsResponse>> {
    try {
      const res = await this.client.request<PasskeyLoginOptionsResponse>(
        '/v1/auth/passkey/login/options',
        {
          method: 'POST',
          body: JSON.stringify({ emailOrPhone }),
        }
      );

      if (!res.success) {
        return this.handleApiError(res.error, 'passkey_options');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'passkey_options');
    }
  }

  /**
   * Verify Passkey login assertion.
   */
  async verifyPasskeyLogin(
    payload: PasskeyLoginVerifyPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'passkey' });

    try {
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/passkey/login/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'passkey_verify');
      }

      await this.persistTokens(res.data);
      trackOnboardingEvent('auth_succeeded', {
        method: 'passkey',
        isNewUser: res.data.user.isNewUser,
      });

      return { success: true, data: res.data };
    } catch (err: unknown) {
      return this.handleNetworkError(err, 'passkey_verify');
    }
  }

  /**
   * Persist access and refresh tokens.
   */
  private async persistTokens(tokens: AuthTokensResponse): Promise<void> {
    const storage = this.client.getStorage();
    await storage.setAccessToken(tokens.accessToken);
    await storage.setRefreshToken(tokens.refreshToken);
  }

  /**
   * Translate API errors into user-friendly messages and detect rate limits.
   */
  private handleApiError(
    error: { code?: string; message?: string; details?: unknown },
    method: string
  ): AuthOperationResult<never> {
    const rawMessage = error?.message || 'Authentication request failed.';
    const isRateLimited =
      error?.code === 'RATE_LIMIT_EXCEEDED' ||
      rawMessage.toLowerCase().includes('rate limit') ||
      rawMessage.toLowerCase().includes('too many');

    if (isRateLimited) {
      const cooldown = 60; // Standard 60-second cooldown
      trackOnboardingEvent('auth_rate_limited', { method, retryAfterSeconds: cooldown });
      return {
        success: false,
        isRateLimited: true,
        retryAfterSeconds: cooldown,
        error: `Too many attempts. Please wait ${cooldown} seconds before trying again.`,
      };
    }

    trackOnboardingEvent('auth_failed', { method, reason: error?.code || 'API_ERROR' });

    // Friendly error mappings
    let friendlyMessage = rawMessage;
    if (rawMessage.toLowerCase().includes('invalid code') || rawMessage.toLowerCase().includes('incorrect')) {
      friendlyMessage = 'Invalid verification code. Please check and try again.';
    } else if (rawMessage.toLowerCase().includes('expired')) {
      friendlyMessage = 'Verification code expired. Please request a new code.';
    }

    return {
      success: false,
      error: friendlyMessage,
    };
  }

  /**
   * Translate network errors gracefully.
   */
  private handleNetworkError(_err: unknown, method: string): AuthOperationResult<never> {
    trackOnboardingEvent('auth_failed', { method, reason: 'NETWORK_ERROR' });

    return {
      success: false,
      error: 'Unable to connect to Nazar servers. Please check your internet connection and try again.',
    };
  }
}

let defaultAuthService: AuthService | null = null;

export function getDefaultAuthService(): AuthService {
  if (!defaultAuthService) {
    defaultAuthService = new AuthService();
  }
  return defaultAuthService;
}
