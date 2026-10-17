import {
  signInWithPhoneNumber,
  type ConfirmationResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type ApplicationVerifier,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase.js';
import { getDefaultAuthService } from './auth-service.js';
import type { AuthOperationResult } from './auth-service.js';
import type { AuthTokensResponse, DeviceRegistrationPayload } from '@platform/api-contracts';

const FIREBASE_API_KEY = 'AIzaSyBwe92HDL56oq1ZcbEED577aKv8nWm00uE';

/**
 * In-memory active confirmation result for ongoing phone verification (Firebase JS SDK)
 */
let activeConfirmationResult: ConfirmationResult | null = null;

export const setActiveConfirmationResult = (result: ConfirmationResult | null): void => {
  activeConfirmationResult = result;
};

export const getActiveConfirmationResult = (): ConfirmationResult | null => {
  return activeConfirmationResult;
};

/**
 * In-memory active Google Identity session info for direct phone verification
 */
let activeSessionInfo: string | null = null;

export const setActiveSessionInfo = (info: string | null): void => {
  activeSessionInfo = info;
};

export const getActiveSessionInfo = (): string | null => {
  return activeSessionInfo;
};

/**
 * Dispatches a real SMS verification code via Google Identity Toolkit with reCAPTCHA
 */
export async function sendFirebasePhoneOtpWithRecaptcha(
  phoneNumber: string,
  recaptchaToken: string
): Promise<{ success: boolean; sessionInfo?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          recaptchaToken,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || data.error) {
      const errMsg = data.error?.message || 'Failed to dispatch verification SMS via Google Firebase';
      return { success: false, error: errMsg };
    }

    activeSessionInfo = data.sessionInfo;
    return { success: true, sessionInfo: data.sessionInfo };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error reaching Google Firebase servers',
    };
  }
}

/**
 * Verifies the 6-digit code with Google Identity Toolkit and exchanges the resulting
 * Firebase ID token with our backend session server.
 */
export async function verifyFirebasePhoneOtp(
  code: string,
  sessionInfo?: string | null,
  device?: DeviceRegistrationPayload
): Promise<AuthOperationResult<AuthTokensResponse>> {
  const effectiveSessionInfo = sessionInfo || activeSessionInfo;
  if (!effectiveSessionInfo) {
    return {
      success: false,
      error: 'No active Firebase phone verification session found.',
    };
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionInfo: effectiveSessionInfo,
          code,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || data.error) {
      const errMsg = data.error?.message || 'Invalid Firebase verification code.';
      return { success: false, error: errMsg };
    }

    activeSessionInfo = null;

    // Exchange Google Firebase ID token with our backend session server
    const idToken = data.idToken;
    const authService = getDefaultAuthService();
    return await authService.loginWithFirebase(idToken, device);
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to verify Firebase code',
    };
  }
}

/**
 * Send an SMS OTP using Firebase Authentication JS SDK
 */
export async function sendFirebasePhoneOtp(
  phoneNumber: string,
  verifier: ApplicationVerifier
): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> {
  try {
    const auth = getFirebaseAuth();
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    activeConfirmationResult = confirmationResult;
    return { success: true, confirmationResult };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send verification SMS via Firebase';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Confirm a Firebase SMS OTP code from ConfirmationResult
 */
export async function confirmFirebasePhoneOtp(
  code: string,
  confirmationResult?: ConfirmationResult | null,
  device?: DeviceRegistrationPayload
): Promise<AuthOperationResult<AuthTokensResponse>> {
  const activeResult = confirmationResult || activeConfirmationResult;
  if (!activeResult) {
    return {
      success: false,
      error: 'No active Firebase phone verification session found.',
    };
  }

  try {
    const userCredential = await activeResult.confirm(code);
    const idToken = await userCredential.user.getIdToken();
    activeConfirmationResult = null;

    const authService = getDefaultAuthService();
    return await authService.loginWithFirebase(idToken, device);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid Firebase verification code.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Send an email sign-in link via Firebase Authentication
 */
export async function sendFirebaseEmailLink(
  email: string,
  continueUrl = 'https://nazar-85664.firebaseapp.com'
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getFirebaseAuth();
    await sendSignInLinkToEmail(auth, email, {
      url: continueUrl,
      handleCodeInApp: true,
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send Firebase sign-in email.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Complete email link sign-in and authenticate with the backend
 */
export async function completeFirebaseEmailLinkSignIn(
  email: string,
  emailLink: string,
  device?: DeviceRegistrationPayload
): Promise<AuthOperationResult<AuthTokensResponse>> {
  try {
    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, emailLink)) {
      return { success: false, error: 'Invalid or expired sign-in link.' };
    }

    const userCredential = await signInWithEmailLink(auth, email, emailLink);
    const idToken = await userCredential.user.getIdToken();

    const authService = getDefaultAuthService();
    return await authService.loginWithFirebase(idToken, device);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to authenticate with email link.';
    return {
      success: false,
      error: message,
    };
  }
}
