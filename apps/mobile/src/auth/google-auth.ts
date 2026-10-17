import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { getDefaultAuthService } from './auth-service.js';
import { useOnboardingStore } from './onboarding-store.js';

import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_IOS_CLIENT_ID =
  '929075066798-ms4sneu7ac8i4s20o8ktdh30jlvseak3.apps.googleusercontent.com';

export const GOOGLE_WEB_CLIENT_ID =
  '929075066798-o6qemj04rnrrlm870fgm43jfif4pp8cj.apps.googleusercontent.com';

export const GOOGLE_REVERSED_CLIENT_ID =
  'com.googleusercontent.apps.929075066798-ms4sneu7ac8i4s20o8ktdh30jlvseak3';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface GoogleSignInResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  email?: string;
  isNewUser?: boolean;
}

/**
 * Initiates the Google OAuth 2.0 flow for iOS and mobile platforms,
 * validates the returned ID token with the Nazar auth service, and
 * persists the session.
 */
export async function promptGoogleSignIn(): Promise<GoogleSignInResult> {
  try {
    const isIOS = Platform.OS === 'ios';
    const effectiveClientId = isIOS ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
    const redirectUri = `${GOOGLE_REVERSED_CLIENT_ID}:/oauthredirect`;

    const request = new AuthSession.AuthRequest({
      clientId: effectiveClientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });

    const result = await request.promptAsync(discovery);

    if (result.type === 'success' && result.params?.code) {
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: effectiveClientId,
          code: result.params.code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier || '',
          },
        },
        discovery
      );

      const idToken = tokenResult.idToken;
      if (!idToken) {
        return {
          success: false,
          error: 'No identity token received from Google.',
        };
      }

      const authService = getDefaultAuthService();
      const loginRes = await authService.loginWithGoogle({ idToken });

      if (!loginRes.success) {
        return {
          success: false,
          error: loginRes.error || 'Failed to authenticate Google identity.',
        };
      }

      useOnboardingStore
        .getState()
        .setAuthIdentifier('google', loginRes.data?.user?.id || 'google_user');

      return {
        success: true,
        isNewUser: loginRes.data?.user?.isNewUser,
      };
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return {
        success: false,
        cancelled: true,
      };
    }

    return {
      success: false,
      error: 'Google Sign-In was not completed.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An error occurred during Google Sign-In.',
    };
  }
}
