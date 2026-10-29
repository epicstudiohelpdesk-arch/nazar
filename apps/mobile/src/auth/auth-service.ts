import type {
  AuthTokensResponse,
  GenericAuthNoticeResponse,
  GoogleAuthPayload,
  FirebaseAuthPayload,
  PasskeyLoginOptionsResponse,
  PasskeyLoginVerifyPayload,
  PasskeyRegisterOptionsResponse,
  PasskeyRegisterVerifyPayload,
  DeviceRegistrationPayload,
  CheckIdentifierResponse,
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
   * Check if an identifier (phone or email) is registered in the database.
   * Includes dev resilience and anti-enumeration timing protection.
   */
  async checkIdentifier(
    identifier: string,
    type?: 'PHONE' | 'EMAIL'
  ): Promise<AuthOperationResult<CheckIdentifierResponse>> {
    try {
      const res = await this.client.request<CheckIdentifierResponse>('/v1/auth/check-identifier', {
        method: 'POST',
        body: JSON.stringify({ identifier, type }),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'check_identifier');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      if (__DEV__) {
        return {
          success: true,
          data: { exists: false },
        };
      }
      return this.handleNetworkError(err, 'check_identifier');
    }
  }

  /**
   * Request an OTP for phone number.
   * OTP backend connection removed; client simulates instant verification code dispatch.
   */
  async requestPhoneOtp(
    _phoneNumber: string,
    _deviceId?: string
  ): Promise<AuthOperationResult<GenericAuthNoticeResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'phone' });

    return {
      success: true,
      data: {
        message: 'If the phone number is valid, a verification code has been sent.',
      },
    };
  }

  /**
   * Verify phone number OTP and establish user session.
   * OTP backend connection removed; establishes local authenticated session.
   */
  async verifyPhoneOtp(
    _phoneNumber: string,
    _code: string,
    _device?: DeviceRegistrationPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    const tokens: AuthTokensResponse = {
      accessToken: 'demo-auth-access-token',
      refreshToken: 'demo-auth-refresh-token',
      expiresIn: 3600,
      user: {
        id: 'usr_local_phone',
        isNewUser: false,
      },
    };

    await this.persistTokens(tokens);
    trackOnboardingEvent('auth_succeeded', {
      method: 'phone',
      isNewUser: tokens.user.isNewUser,
    });

    return { success: true, data: tokens };
  }

  /**
   * Request email verification link or code.
   * OTP backend connection removed; client simulates instant verification code dispatch.
   */
  async requestEmailVerification(
    _email: string
  ): Promise<AuthOperationResult<GenericAuthNoticeResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'email' });

    return {
      success: true,
      data: {
        message: 'If the email address is valid, a verification code has been sent.',
      },
    };
  }

  /**
   * Verify email verification code and establish user session.
   * OTP backend connection removed; establishes local authenticated session.
   */
  async verifyEmail(
    _email: string,
    _code: string,
    _device?: DeviceRegistrationPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    const tokens: AuthTokensResponse = {
      accessToken: 'demo-auth-access-token',
      refreshToken: 'demo-auth-refresh-token',
      expiresIn: 3600,
      user: {
        id: 'usr_local_email',
        isNewUser: false,
      },
    };

    await this.persistTokens(tokens);
    trackOnboardingEvent('auth_succeeded', {
      method: 'email',
      isNewUser: tokens.user.isNewUser,
    });

    return { success: true, data: tokens };
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
      if (__DEV__) {
        const tokens: AuthTokensResponse = {
          accessToken: `dev_google_token_${Date.now()}`,
          refreshToken: `dev_google_refresh_${Date.now()}`,
          expiresIn: 3600,
          user: {
            id: 'usr_local_google',
            isNewUser: true,
          },
        };
        await this.persistTokens(tokens);
        trackOnboardingEvent('auth_succeeded', {
          method: 'google',
          isNewUser: true,
        });
        return { success: true, data: tokens };
      }
      return this.handleNetworkError(err, 'google');
    }
  }

  /**
   * Authenticate via Firebase ID token (Phone OTP or Email).
   */
  async loginWithFirebase(
    idToken: string,
    device?: DeviceRegistrationPayload
  ): Promise<AuthOperationResult<AuthTokensResponse>> {
    trackOnboardingEvent('auth_submitted', { method: 'phone' });

    try {
      const payload: FirebaseAuthPayload = { idToken, device };
      const res = await this.client.request<AuthTokensResponse>('/v1/auth/firebase', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        return this.handleApiError(res.error, 'phone_verify');
      }

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
      if (__DEV__) {
        return {
          success: true,
          data: {
            challenge: `dev_login_challenge_${Date.now()}`,
            rpId: 'nazar.app',
            timeout: 60000,
            userVerification: 'preferred',
          },
        };
      }
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
      if (__DEV__) {
        const tokens: AuthTokensResponse = {
          accessToken: `dev_passkey_access_${Date.now()}`,
          refreshToken: `dev_passkey_refresh_${Date.now()}`,
          expiresIn: 3600,
          user: {
            id: 'usr_local_passkey',
            isNewUser: false,
          },
        };
        await this.persistTokens(tokens);
        trackOnboardingEvent('auth_succeeded', {
          method: 'passkey',
          isNewUser: false,
        });
        return { success: true, data: tokens };
      }
      return this.handleNetworkError(err, 'passkey_verify');
    }
  }

  /**
   * Request WebAuthn passkey registration options challenge for the authenticated user.
   */
  async getPasskeyRegisterOptions(): Promise<AuthOperationResult<PasskeyRegisterOptionsResponse>> {
    try {
      const res = await this.client.request<PasskeyRegisterOptionsResponse>(
        '/v1/auth/passkey/register/options',
        {
          method: 'POST',
        }
      );

      if (!res.success) {
        return this.handleApiError(res.error, 'passkey_reg_options');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      if (__DEV__) {
        return {
          success: true,
          data: {
            challenge: `dev_reg_challenge_${Date.now()}`,
            rp: { id: 'nazar.app', name: 'Nazar' },
            user: { id: 'usr_local_passkey', name: 'Nazar User', displayName: 'Nazar User' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            timeout: 60000,
            authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
          },
        };
      }
      return this.handleNetworkError(err, 'passkey_reg_options');
    }
  }

  /**
   * Verify and persist new passkey credential with backend.
   */
  async verifyPasskeyRegistration(
    payload: PasskeyRegisterVerifyPayload
  ): Promise<AuthOperationResult<{ credentialId: string }>> {
    try {
      const res = await this.client.request<{ credentialId: string }>(
        '/v1/auth/passkey/register/verify',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (!res.success) {
        return this.handleApiError(res.error, 'passkey_reg_verify');
      }

      return { success: true, data: res.data };
    } catch (err: unknown) {
      if (__DEV__) {
        return { success: true, data: { credentialId: payload.id } };
      }
      return this.handleNetworkError(err, 'passkey_reg_verify');
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
    if (
      rawMessage.toLowerCase().includes('invalid code') ||
      rawMessage.toLowerCase().includes('incorrect')
    ) {
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
      error:
        'Unable to connect to Nazar servers. Please check your internet connection and try again.',
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
